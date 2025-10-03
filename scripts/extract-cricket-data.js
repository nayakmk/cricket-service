const fs = require('fs');
const path = require('path');
const { db, collections } = require('../config/database');

// Dynamic import for pdf-parse (ES module)
let pdfParse;
(async () => {
  const pdfModule = await import('pdf-parse');
  pdfParse = pdfModule.default;
})();

class CricketDataExtractor {
  constructor() {
    this.reportsDir = path.join(__dirname, '..', 'reports');
    this.extractedData = [];
  }

  /**
   * Get all PDF files from the reports directory
   */
  getPdfFiles() {
    try {
      const files = fs.readdirSync(this.reportsDir);
      return files.filter(file => file.endsWith('.pdf'));
    } catch (error) {
      console.error('Error reading reports directory:', error);
      return [];
    }
  }

  /**
   * Extract text content from a PDF file
   */
  async extractTextFromPdf(filePath) {
    try {
      // Ensure pdf-parse is loaded
      if (!pdfParse) {
        const pdfModule = await import('pdf-parse');
        pdfParse = pdfModule.default;
      }

      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return {
        fileName: path.basename(filePath),
        text: data.text,
        pages: data.numpages,
        info: data.info
      };
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extract data from all PDF files
   */
  async extractAllData() {
    const pdfFiles = this.getPdfFiles();
    console.log(`Found ${pdfFiles.length} PDF files to process`);

    for (const pdfFile of pdfFiles) {
      const filePath = path.join(this.reportsDir, pdfFile);
      console.log(`Processing: ${pdfFile}`);

      const extractedData = await this.extractTextFromPdf(filePath);
      if (extractedData) {
        this.extractedData.push(extractedData);
      }
    }

    return this.extractedData;
  }

  /**
   * Parse cricket match data from extracted text
   */
  parseMatchData(text) {
    const matchData = {
      teams: [],
      players: [],
      innings: [],
      match: {}
    };

    // Split text into lines for processing
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Extract team names (usually appear early in the scorecard)
    const teamPatterns = [
      /([A-Za-z\s]+)\s+vs\s+([A-Za-z\s]+)/i,
      /([A-Za-z\s]+)\s+v\s+([A-Za-z\s]+)/i,
      /Team\s*1:\s*([A-Za-z\s]+)/i,
      /Team\s*2:\s*([A-Za-z\s]+)/i
    ];

    for (const line of lines.slice(0, 20)) { // Check first 20 lines for team info
      for (const pattern of teamPatterns) {
        const match = line.match(pattern);
        if (match) {
          if (match[1] && match[2]) {
            matchData.teams.push(match[1].trim(), match[2].trim());
          } else if (match[1]) {
            matchData.teams.push(match[1].trim());
          }
        }
      }
    }

    // Extract player names and scores
    const playerScorePattern = /([A-Za-z\s]+)\s+(\d+)\s*\((\d+)\)/;
    const bowlingPattern = /([A-Za-z\s]+)\s+(\d+)\.(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;

    for (const line of lines) {
      // Batting scores
      const battingMatch = line.match(playerScorePattern);
      if (battingMatch) {
        matchData.players.push({
          name: battingMatch[1].trim(),
          runs: parseInt(battingMatch[2]),
          balls: parseInt(battingMatch[3]),
          type: 'batting'
        });
      }

      // Bowling figures
      const bowlingMatch = line.match(bowlingPattern);
      if (bowlingMatch) {
        matchData.players.push({
          name: bowlingMatch[1].trim(),
          overs: parseFloat(`${bowlingMatch[2]}.${bowlingMatch[3]}`),
          maidens: parseInt(bowlingMatch[4]),
          runs: parseInt(bowlingMatch[5]),
          wickets: parseInt(bowlingMatch[6]),
          type: 'bowling'
        });
      }
    }

    // Extract match result and basic info
    const resultPatterns = [
      /([A-Za-z\s]+)\s+won\s+by\s+(\d+)\s+runs?/i,
      /([A-Za-z\s]+)\s+won\s+by\s+(\d+)\s+wicket/i,
      /Match\s+tied/i,
      /Match\s+abandoned/i
    ];

    for (const line of lines) {
      for (const pattern of resultPatterns) {
        const match = line.match(pattern);
        if (match) {
          matchData.match.result = line;
          break;
        }
      }
    }

    return matchData;
  }

  /**
   * Process all extracted data and create structured cricket data
   */
  processAllData() {
    const processedData = [];

    for (const pdfData of this.extractedData) {
      const matchData = this.parseMatchData(pdfData.text);
      processedData.push({
        fileName: pdfData.fileName,
        ...matchData
      });
    }

    return processedData;
  }

  /**
   * Save extracted data to JSON file for analysis
   */
  saveExtractedData(data, outputPath = 'extracted-cricket-data.json') {
    try {
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`Extracted data saved to ${outputPath}`);
    } catch (error) {
      console.error('Error saving extracted data:', error);
    }
  }
}

// Export for use in other scripts
module.exports = CricketDataExtractor;

// If run directly, extract data from PDFs
if (require.main === module) {
  (async () => {
    const extractor = new CricketDataExtractor();

    try {
      await extractor.extractAllData();
      const processedData = extractor.processAllData();
      extractor.saveExtractedData(processedData);
      console.log('Data extraction completed successfully!');
      console.log(`Processed ${processedData.length} PDF files`);
    } catch (error) {
      console.error('Error during data extraction:', error);
    }
  })();
}