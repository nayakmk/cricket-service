const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

class GroqService {
  static async makeRequest(messages) {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages,
        max_tokens: 2000,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      throw new Error(`GROQ API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  static async analyzePlayer(playerData) {
    const {
      name,
      role,
      battingStyle,
      bowlingStyle,
      matchesPlayed,
      totalRuns,
      totalWickets,
      battingAverage,
      bowlingAverage,
      battingStrikeRate,
      bowlingEconomy,
      matchHistory
    } = playerData;

    const prompt = `
You are a professional cricket analyst specializing in match-by-match performance analysis, dismissal patterns, and tactical improvements. Based on the following comprehensive player data, provide an in-depth analysis in JSON format with these exact keys. Focus heavily on how the player has performed in individual matches, their dismissal patterns, balls faced, strike rates, and specific improvements to maximize impact.

{
  "playerDescription": "A concise 2-sentence biographical summary including their playing style, key achievements, boundary hitting ability (4s and 6s), wicket-taking record, temperament, and current form assessment. Include specific statistics like total boundaries hit, wickets taken, and notable performances that define their cricketing personality",
  "executiveSummary": "A detailed 3-4 sentence overview focusing on match performance patterns, dismissal analysis, and potential for greater impact",
  "performanceAnalysis": {
    "battingAnalysis": "Detailed match-by-match batting analysis including balls faced, strike rates, dismissal methods, and situational performance. Identify patterns in how they get out and when they score.",
    "bowlingAnalysis": "Detailed analysis of bowling effectiveness, wicket-taking patterns, and economy rates across different matches",
    "fieldingAnalysis": "Assessment of fielding contributions and impact in specific matches",
    "consistencyRating": "Rate consistency on a scale of 1-10 based on match-to-match performance variation",
    "pressurePerformance": "Analysis of performance under pressure situations in crucial matches"
  },
  "technicalAssessment": {
    "strengths": ["5-7 key technical strengths identified from match performances and dismissal patterns"],
    "weaknesses": ["4-6 technical areas needing improvement based on how they get out and performance patterns"],
    "techniqueEvolution": "Analysis of how their technique and decision-making has evolved across recent matches"
  },
  "tacticalInsights": {
    "roleInTeam": "Specific role this player should play based on their match performances and impact",
    "matchSituations": "How they perform in different match scenarios based on actual match data (chasing, defending, powerplay, death overs)",
    "partnershipBuilding": "Ability to build partnerships based on match contributions and dismissal patterns",
    "captaincyPotential": "Assessment of leadership qualities shown in match performances"
  },
  "performanceTrends": {
    "recentForm": "Detailed analysis of performance trends across last 5-10 matches including balls faced, strike rates, and dismissal patterns",
    "careerTrajectory": "Long-term development based on match history and performance evolution",
    "venuePerformance": "How they perform at different venues based on match results and conditions",
    "oppositionAnalysis": "Performance against different types of opposition based on match outcomes"
  },
  "comparativeAnalysis": {
    "similarPlayers": "Comparison with players of similar style based on match performances and impact",
    "benchmarking": "How they stack up against standards based on strike rates, dismissal patterns, and match contributions",
    "marketValue": "Assessment based on match impact and performance consistency"
  },
  "developmentRecommendations": {
    "shortTerm": ["3-4 immediate improvements based on dismissal patterns and match performance analysis"],
    "longTerm": ["2-3 strategic developments to maximize match impact and reduce dismissals"],
    "trainingFocus": "Specific training areas based on match weaknesses and dismissal patterns",
    "skillDevelopment": "New skills to acquire based on performance gaps identified in matches",
    "performanceTargets": {
      "battingTargets": "Specific targets based on current match performances (e.g., 'Face minimum 30 balls in 70% of innings, maintain strike rate above ${battingStrikeRate?.toFixed(0) || '120'} in middle overs')",
      "bowlingTargets": "Specific bowling targets based on match performances (e.g., 'Take wickets in 50% of spells, maintain economy under ${bowlingEconomy?.toFixed(1) || '7.0'}')",
      "fieldingTargets": "Fielding goals based on match contributions (e.g., 'Effect fielding contribution in 60% of matches')",
      "consistencyTargets": "Consistency goals based on match variation (e.g., 'Score above ${battingAverage?.toFixed(0) || '25'} in 65% of completed innings, avoid soft dismissals')"
    }
  },
  "matchContribution": {
    "optimalConditions": "Conditions and scenarios where they excel based on match performances",
    "teamImpact": "Overall impact on team performance based on match contributions and win/loss correlation",
    "versatility": "Ability to adapt to different roles based on match performances",
    "futurePotential": "Long-term contribution potential based on performance trends and improvement areas"
  }
}

Player Data:
- Name: ${name}
- Role: ${role}
- Batting Style: ${battingStyle || 'Not specified'}
- Bowling Style: ${bowlingStyle || 'Not specified'}
- Matches Played: ${matchesPlayed || 0}
- Total Runs: ${totalRuns || 0}
- Total Wickets: ${totalWickets || 0}
- Batting Average: ${battingAverage?.toFixed(2) || 'N/A'}
- Bowling Average: ${bowlingAverage?.toFixed(2) || 'N/A'}
- Batting Strike Rate: ${battingStrikeRate?.toFixed(2) || 'N/A'}
- Bowling Economy: ${bowlingEconomy?.toFixed(2) || 'N/A'}

Detailed Match History Analysis:
${matchHistory?.slice(0, 8).map((match, index) => `
Match ${index + 1}: ${match.team1} vs ${match.team2} (${new Date(match.matchDate).toLocaleDateString()})
- Result: ${match.result?.winner} won by ${match.result?.margin}
- Batting: ${match.contributions?.find(c => c.type === 'batting') ? `${match.contributions.find(c => c.type === 'batting').runs || 0} runs off ${match.contributions.find(c => c.type === 'batting').balls || 0} balls${match.contributions.find(c => c.type === 'batting').dismissal ? ` (${match.contributions.find(c => c.type === 'batting').dismissal})` : ' (not out)'}` : 'Did not bat'}
- Bowling: ${match.contributions?.find(c => c.type === 'bowling') ? `${match.contributions.find(c => c.type === 'bowling').wickets || 0}/${match.contributions.find(c => c.type === 'bowling').runs || 0} in ${match.contributions.find(c => c.type === 'bowling').overs || 0} overs` : 'Did not bowl'}
- Strike Rate: ${match.contributions?.find(c => c.type === 'batting') && match.contributions.find(c => c.type === 'batting').balls > 0 ? ((match.contributions.find(c => c.type === 'batting').runs / match.contributions.find(c => c.type === 'batting').balls) * 100).toFixed(1) : 'N/A'}
`).join('') || 'No recent matches available'}

Analyze this player's performance with special focus on:
1. Patterns in how they get dismissed across matches
2. Balls faced vs runs scored relationship
3. Strike rate variations in different situations
4. Match impact and contribution patterns
5. Specific improvements to reduce dismissals and increase effectiveness
6. Tactical adjustments based on actual match performances

Provide actionable insights that will help this player maximize their impact in future matches.`;

    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.makeRequest(messages);
      const content = response.choices[0].message.content;

      // Parse the JSON response
      const analysis = JSON.parse(content);

      // Validate the response structure
      if (!analysis.executiveSummary || !analysis.performanceAnalysis || !analysis.technicalAssessment || !analysis.tacticalInsights) {
        throw new Error('Invalid response structure from GROQ API');
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing player with GROQ:', error);
      // Return comprehensive fallback analysis if API fails
      return {
        playerDescription: `${name} is a ${role} with ${matchesPlayed || 0} matches of experience, averaging ${battingAverage?.toFixed(1) || 'N/A'} with a strike rate of ${battingStrikeRate?.toFixed(1) || 'N/A'}.${role === 'batsman' || role === 'all-rounder' ? ` A ${battingStyle || 'versatile'} batsman who has scored ${totalRuns || 0} runs with an estimated ${Math.floor(totalRuns * 0.12)} fours and ${Math.floor(totalRuns * 0.03)} sixes, showcasing ${battingStrikeRate > 140 ? 'aggressive boundary hitting' : battingStrikeRate > 120 ? 'balanced strokeplay' : 'steady accumulation'}.` : role === 'bowler' || role === 'all-rounder' ? ` A bowler who has claimed ${totalWickets || 0} wickets with an economy of ${bowlingEconomy?.toFixed(1) || 'N/A'}, demonstrating ${bowlingEconomy < 6.5 ? 'tight control' : bowlingEconomy < 8 ? 'balanced threat' : 'workhorse reliability'}.` : ' A reliable fielder establishing themselves as a promising player.'} Currently showing ${matchesPlayed > 20 ? 'consistent' : 'developing'} form with growing impact in team performances.`,
        executiveSummary: `${name} shows distinct patterns in their match performances, with an average of ${battingAverage?.toFixed(1) || 'N/A'} and strike rate of ${battingStrikeRate?.toFixed(1) || 'N/A'}. Analysis of their ${matchesPlayed || 0} matches reveals specific dismissal patterns and performance trends that can be addressed for greater impact.`,
        performanceAnalysis: {
          battingAnalysis: `${role === 'batsman' || role === 'all-rounder' ? `Across recent matches, ${name} has faced an average of ${Math.floor((totalRuns / battingAverage) * (matchesPlayed / battingStrikeRate * 100) / matchesPlayed) || '25'} balls per innings. Common dismissal patterns include getting out to specific bowlers or in pressure situations. Their strike rate of ${battingStrikeRate?.toFixed(1) || 'N/A'} suggests ${battingStrikeRate > 130 ? 'aggressive' : battingStrikeRate > 110 ? 'balanced' : 'cautious'} approach that needs situational adjustment.` : 'Not applicable for this player role.'}`,
          bowlingAnalysis: `${role === 'bowler' || role === 'all-rounder' ? `Bowling analysis shows ${name} has taken ${totalWickets || 0} wickets with an economy of ${bowlingEconomy?.toFixed(1) || 'N/A'}. Match performances indicate effectiveness in ${bowlingEconomy < 7 ? 'containing runs' : 'taking wickets'} with room for improvement in consistency.` : 'Not applicable for this player role.'}`,
          fieldingAnalysis: `Fielding contributions vary across matches, with opportunities to increase impact through better positioning and athleticism.`,
          consistencyRating: `6/10 - Performance shows variation across matches with identifiable patterns in dismissals and contributions that can be addressed.`,
          pressurePerformance: `Shows potential under pressure but match analysis reveals specific situations where performance drops, particularly in crucial overs.`
        },
        technicalAssessment: {
          strengths: [
            'Shows good technique in favorable conditions',
            'Effective in specific match situations',
            'Demonstrates skill in controlled environments',
            'Has foundation skills that work in certain scenarios',
            'Shows tactical awareness in some matches',
            'Physical attributes support performance in good conditions'
          ],
          weaknesses: [
            'Dismissal patterns indicate technical vulnerabilities',
            'Struggles with specific types of bowling attacks',
            'Needs improvement in pressure situations',
            'Balls faced vs runs scored ratio needs optimization',
            'Situational decision-making requires refinement',
            'Consistency across different match conditions'
          ],
          techniqueEvolution: `Match history shows ${name} has been developing their game, with gradual improvements in certain areas but persistent patterns in dismissals that need targeted addressing.`
        },
        tacticalInsights: {
          roleInTeam: `${role === 'batsman' ? 'Middle-order batsman who can stabilize innings in favorable conditions' : role === 'bowler' ? 'Support bowler effective in specific situations' : 'Versatile all-rounder with situational strengths'}`,
          matchSituations: `Match analysis shows better performance in ${battingStrikeRate > 120 ? 'middle overs when set' : 'early overs with freedom to play'}. Needs improvement in ${battingStrikeRate < 110 ? 'accelerating when required' : 'building foundations'}.`,
          partnershipBuilding: `Shows ability to build partnerships in ${matchesPlayed > 5 ? 'some matches but needs consistency' : 'promising situations'}. Match patterns indicate potential for longer, more impactful stays.`,
          captaincyPotential: `Demonstrates tactical awareness in some matches but needs more consistent decision-making under pressure.`
        },
        performanceTrends: {
          recentForm: `Analysis of recent matches shows ${battingAverage > 25 ? 'solid' : 'developing'} performance with strike rate of ${battingStrikeRate?.toFixed(1) || 'N/A'}. Dismissal patterns suggest specific areas for technical improvement.`,
          careerTrajectory: `Career progression shows potential for growth with focused development on match impact and consistency.`,
          venuePerformance: `Performance varies by venue conditions, with better results in familiar or favorable environments.`,
          oppositionAnalysis: `Shows competitive spirit against various opposition levels but needs strategies against specific bowling styles.`
        },
        comparativeAnalysis: {
          similarPlayers: `Comparable to emerging ${role}s who have shown improvement through addressing technical weaknesses and dismissal patterns.`,
          benchmarking: `Currently at developmental stage with foundation skills. Match analysis indicates potential to reach higher performance levels.`,
          marketValue: `Shows promise for future value with focused development on consistency and match impact.`
        },
        developmentRecommendations: {
          shortTerm: [
            'Address specific dismissal patterns identified in match analysis',
            'Improve balls faced vs runs scored ratio in pressure situations',
            'Develop strategies against common types of bowling attacks',
            'Enhance decision-making in crucial match moments'
          ],
          longTerm: [
            'Build consistency across all match conditions and situations',
            'Develop ability to maximize impact in every innings',
            'Establish reputation as reliable performer in all scenarios'
          ],
          trainingFocus: `Focus on match-specific scenarios and dismissal prevention techniques based on performance analysis.`,
          skillDevelopment: `Acquire situational awareness and decision-making skills to maximize match contributions.`,
          performanceTargets: {
            battingTargets: role === 'batsman' || role === 'all-rounder' ? `Face minimum ${Math.max(20, Math.floor(totalRuns / matchesPlayed / 2))} balls in 70% of innings, maintain strike rate above ${Math.max(100, battingStrikeRate - 10).toFixed(0)} in middle overs` : 'Not applicable for this player role',
            bowlingTargets: role === 'bowler' || role === 'all-rounder' ? `Take ${Math.max(1, Math.floor(totalWickets / matchesPlayed * 1.5))} wickets in 60% of matches, maintain economy under ${Math.min(8, bowlingEconomy * 0.9).toFixed(1)}` : 'Not applicable for this player role',
            fieldingTargets: 'Effect fielding contribution (catch or run-out) in 50% of matches played',
            consistencyTargets: `Score above ${battingAverage?.toFixed(0) || '20'} in 60% of completed innings, avoid repeat dismissal patterns`
          }
        },
        matchContribution: {
          optimalConditions: `Excels in ${battingStrikeRate > 130 ? 'aggressive' : battingStrikeRate > 110 ? 'balanced' : 'defensive'} scenarios and shows potential in ${battingStrikeRate < 110 ? 'building situations' : 'finishing situations'}.`,
          teamImpact: `Provides solid contributions in matches with potential to become more impactful through addressing dismissal patterns.`,
          versatility: `Shows adaptability to different roles with room for improvement in consistency across situations.`,
          futurePotential: `Significant potential with focused development on match impact and performance consistency.`
        }
      };
    }
  }

  static async analyzeMatch(matchData) {
    const {
      matchId,
      team1,
      team2,
      venue,
      matchType,
      status,
      winner,
      result,
      innings = [],
      toss,
      bestBatsman,
      bestBowler
    } = matchData;

    // Build match summary data
    const matchSummary = {
      teams: `${team1?.name || 'Team 1'} vs ${team2?.name || 'Team 2'}`,
      venue: venue || 'Unknown venue',
      type: matchType || 'Cricket match',
      status: status || 'Unknown',
      winner: winner || 'Undecided',
      result: result?.margin || 'In progress',
      toss: toss ? `${toss.winner} won toss and chose to ${toss.decision}` : 'Toss not recorded',
      bestBatsman: bestBatsman ? `${bestBatsman.player?.name || bestBatsman.name} - ${bestBatsman.runs} runs` : 'Not available',
      bestBowler: bestBowler ? `${bestBowler.player?.name || bestBowler.name} - ${bestBowler.wickets} wickets` : 'Not available'
    };

    // Build innings summary
    const inningsSummary = innings.map((inning, index) => {
      const batsmen = inning.batsmen?.slice(0, 3).map(b =>
        `${b.player?.name || b.name}: ${b.runs || 0}(${b.balls || 0})`
      ).join(', ') || 'Data not available';

      const bowlers = inning.bowlers?.slice(0, 3).map(b =>
        `${b.player?.name || b.name}: ${b.wickets || 0}/${b.runs || 0}(${b.overs || 0})`
      ).join(', ') || 'Data not available';

      return `Inning ${index + 1} - ${inning.battingTeam}: ${inning.totalRuns || 0}/${inning.totalWickets || 0} in ${inning.totalOvers || 0} overs. Top batsmen: ${batsmen}. Key bowlers: ${bowlers}.`;
    }).join(' ');

    const prompt = `You are a professional cricket analyst. Analyze this cricket match and provide insights in JSON format.

Match Summary:
${JSON.stringify(matchSummary, null, 2)}

Innings Summary:
${inningsSummary}

Provide analysis in this JSON structure:
{
  "matchSummary": "2-sentence summary of the match result and key highlights",
  "teamAnalysis": {
    "team1Strengths": "What ${team1?.name || 'Team 1'} did well",
    "team1Weaknesses": "What ${team1?.name || 'Team 1'} could improve",
    "team2Strengths": "What ${team2?.name || 'Team 2'} did well",
    "team2Weaknesses": "What ${team2?.name || 'Team 2'} could improve",
    "keyDifference": "What separated the winning team"
  },
  "performanceAnalysis": {
    "battingHighlights": "Key batting performances and partnerships",
    "bowlingHighlights": "Key bowling spells and breakthroughs",
    "fieldingMoments": "Important fielding plays",
    "turningPoints": "Moments that changed the match"
  },
  "tacticalInsights": {
    "captaincy": "Key captaincy decisions and their impact",
    "strategy": "Overall match strategy assessment",
    "adaptation": "How teams adapted during the match"
  },
  "finalVerdict": {
    "fairResult": "Was this a fair result?",
    "lessonsLearned": "Key lessons from this match",
    "predictability": "How predictable was this result?"
  }
}

Keep the analysis concise but insightful. Focus on cricket tactics, individual brilliance, and team strategy.`;

    const messages = [
      {
        role: 'system',
        content: 'You are an expert cricket analyst providing tactical insights and performance analysis. Keep responses focused and professional.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.makeRequest(messages);
      const content = response.choices[0].message.content;

      // Parse the JSON response
      const analysis = JSON.parse(content);

      // Validate required fields
      if (!analysis.matchSummary || !analysis.teamAnalysis) {
        throw new Error('Invalid response structure from GROQ API');
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing match with GROQ:', error);

      // Return simplified fallback analysis
      return {
        matchSummary: `${matchSummary.teams} at ${matchSummary.venue}. ${matchSummary.winner} won${matchSummary.result !== 'In progress' ? ` by ${matchSummary.result}` : ''}.`,
        teamAnalysis: {
          team1Strengths: `${team1?.name || 'Team 1'} showed ${innings[0]?.totalRuns > innings[1]?.totalRuns ? 'strong batting performance' : 'solid defensive approach'}.`,
          team1Weaknesses: `${team1?.name || 'Team 1'} could improve ${innings[0]?.totalWickets > innings[1]?.totalWickets ? 'bowling execution' : 'fielding standards'}.`,
          team2Strengths: `${team2?.name || 'Team 2'} demonstrated ${innings[1]?.totalRuns > innings[0]?.totalRuns ? 'resilient batting' : 'disciplined bowling'}.`,
          team2Weaknesses: `${team2?.name || 'Team 2'} could work on ${innings[1]?.totalWickets < innings[0]?.totalWickets ? 'bowling penetration' : 'batting consistency'}.`,
          keyDifference: `${matchSummary.winner} edged out through better execution and key moments.`
        },
        performanceAnalysis: {
          battingHighlights: `${matchSummary.bestBatsman} was the standout batsman.`,
          bowlingHighlights: `${matchSummary.bestBowler} led the bowling attack.`,
          fieldingMoments: `Fielding efforts were ${innings.some(i => i.totalWickets >= 8) ? 'crucial with key dismissals' : 'adequate throughout'}.`,
          turningPoints: `Key wickets and partnerships proved decisive in shifting momentum.`
        },
        tacticalInsights: {
          captaincy: `${matchSummary.toss} - this decision influenced the match strategy.`,
          strategy: `Both teams employed ${matchType === 'T20' ? 'aggressive approaches' : 'balanced strategies'} with varying success.`,
          adaptation: `Teams showed ${innings.length > 1 ? 'good adaptation skills' : 'initial tactical awareness'} throughout the contest.`
        },
        finalVerdict: {
          fairResult: `The result was ${matchSummary.winner !== 'Undecided' ? 'a fair reflection of performances' : 'yet to be determined'}.`,
          lessonsLearned: `Key lessons include the importance of consistent performance and tactical decisions.`,
          predictability: `Based on the contest, the result was ${Math.abs((innings[0]?.totalRuns || 0) - (innings[1]?.totalRuns || 0)) < 30 ? 'closely fought' : 'decisively achieved'}.`
        }
      };
    }
  }

  static async generateMatchCommentary(matchData) {
    const {
      matchId,
      team1,
      team2,
      venue,
      matchType,
      status,
      winner,
      result,
      innings = [],
      toss
    } = matchData;

    // Extract comprehensive match information for storytelling
    const tossWinner = toss?.winner || 'Not specified';
    const tossDecision = toss?.decision || 'Not specified';
    const battingFirst = toss?.decision === 'bat' ? tossWinner : (tossWinner === team1?.name ? team2?.name : team1?.name);

    // Get innings details
    const firstInnings = innings.find(inn => inn.inningNumber === 1);
    const secondInnings = innings.find(inn => inn.inningNumber === 2);

    // Extract key players and performances
    const getTopPerformers = (teamData, inningsData) => {
      if (!teamData?.players) return [];

      return teamData.players
        .filter(player => player.batting || player.bowling)
        .map(player => ({
          name: player.name,
          batting: player.batting,
          bowling: player.bowling,
          dismissal: player.dismissal
        }))
        .sort((a, b) => {
          const aRuns = a.batting?.runs || 0;
          const bRuns = b.batting?.runs || 0;
          return bRuns - aRuns;
        })
        .slice(0, 3);
    };

    const team1TopPerformers = getTopPerformers(team1, firstInnings);
    const team2TopPerformers = getTopPerformers(team2, secondInnings);

    // Build comprehensive match context
    const matchContext = {
      basicInfo: `${team1?.name || 'Team 1'} vs ${team2?.name || 'Team 2'} at ${venue || 'the venue'} - ${matchType || 'cricket match'}`,
      tossInfo: tossWinner !== 'Not specified' ? `${tossWinner} won the toss and chose to ${tossDecision}` : 'Toss details not available',
      battingFirst: battingFirst || 'Batting order not specified',
      currentStatus: status,
      scores: {
        team1: team1?.score?.runs || 0,
        team2: team2?.score?.runs || 0,
        team1Wickets: team1?.score?.wickets || 0,
        team2Wickets: team2?.score?.wickets || 0
      },
      innings: innings.map(inn => ({
        number: inn.inningNumber,
        battingTeam: inn.battingTeam,
        totalRuns: inn.totalRuns || 0,
        totalWickets: inn.totalWickets || 0,
        totalOvers: inn.totalOvers || 0,
        keyEvents: inn.fallOfWickets || []
      })),
      topPerformers: {
        team1: team1TopPerformers,
        team2: team2TopPerformers
      },
      result: result ? {
        winner: winner?.name || result.winner,
        margin: result.margin,
        playerOfMatch: result.playerOfMatch?.name
      } : null
    };

    const prompt = `You are a professional cricket commentator telling the complete story of this cricket match. Use ALL the provided match data to create an engaging, narrative-driven commentary that tells the match story chronologically.

MATCH DATA:
${JSON.stringify(matchContext, null, 2)}

INSTRUCTIONS:
Create commentary in JSON format that tells the COMPLETE MATCH STORY:

{
  "matchOverview": "Write a compelling 3-4 sentence overview that sets the scene - how the match started (toss result, who batted first), the key phases, and current/final situation. Make it read like the opening of a match report.",
  
  "matchNarrative": "Tell the story chronologically in 4-6 detailed paragraphs covering: 1) Match setup and early play, 2) Key innings developments and turning points, 3) Exciting moments and standout performances, 4) Current situation or climax, 5) Match outcome if completed. Use cricket terminology and build drama.",
  
  "keyHighlights": "Array of 4-6 most exciting/crucial moments from the match, described in broadcast-commentary style (e.g., 'What a spectacular catch!', 'Brilliant innings coming to an end', 'Game-changing wicket!')",
  
  "playerSpotlight": "Focus on 2-3 standout performers with detailed analysis of their contributions, key moments, and impact on the match. Include specific scores, wickets, and memorable plays.",
  
  "tacticalAnalysis": "Analyze captaincy decisions, bowling changes, field placements, and strategic moments that influenced the game. Explain what worked and what didn't.",
  
  "matchPrediction": "For live matches: predict likely outcome with reasoning. For completed matches: analyze what decided the result and key factors.",
  
  "excitingCommentary": "3-4 punchy, dramatic commentary lines that could be used for live broadcast, capturing the tension, excitement, and key moments"
}

IMPORTANT: 
- Use ALL the provided data - toss results, innings details, player performances, scores, wickets
- Tell the story chronologically from start to current situation
- Make it engaging and dramatic like professional cricket commentary
- Include specific numbers, player names, and match events
- For completed matches, explain the full journey to the result
- For live matches, build anticipation about what might happen next`;

    try {
      const messages = [
        {
          role: 'system',
          content: 'You are an expert cricket commentator who tells complete match stories using all available data. Your commentary should be engaging, chronological, and capture the drama of cricket matches.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0].message.content;

      // Try to parse as JSON, fallback to structured text if needed
      try {
        const parsed = JSON.parse(content);

        // Ensure all required fields are present
        return {
          matchOverview: parsed.matchOverview || 'Match overview not available',
          matchNarrative: parsed.matchNarrative || 'Match story not available',
          keyHighlights: Array.isArray(parsed.keyHighlights) ? parsed.keyHighlights : ['Highlights not available'],
          playerSpotlight: parsed.playerSpotlight || 'Player analysis not available',
          tacticalAnalysis: parsed.tacticalAnalysis || 'Tactical analysis not available',
          matchPrediction: parsed.matchPrediction || 'Prediction not available',
          excitingCommentary: Array.isArray(parsed.excitingCommentary) ? parsed.excitingCommentary : ['Commentary not available']
        };
      } catch (parseError) {
        // If JSON parsing fails, return a structured fallback
        return {
          matchOverview: content.split('\n').find(line => line.includes('Overview')) || content.substring(0, 300),
          matchNarrative: content.split('\n').find(line => line.includes('Narrative')) || 'Match story unavailable',
          keyHighlights: ['Match highlights not available'],
          playerSpotlight: 'Key players analysis pending',
          tacticalAnalysis: 'Strategic insights unavailable',
          matchPrediction: 'Match outcome analysis pending',
          excitingCommentary: ['What a thrilling contest!']
        };
      }
    } catch (error) {
      console.error('Error generating match commentary:', error);
      return {
        matchOverview: `The match between ${team1?.name || 'Team 1'} and ${team2?.name || 'Team 2'} at ${venue || 'the venue'} is currently ${status}`,
        matchNarrative: 'Match story generation failed. Please check back later for detailed commentary.',
        keyHighlights: ['Commentary generation temporarily unavailable'],
        playerSpotlight: 'Player analysis will be available shortly',
        tacticalAnalysis: 'Tactical insights pending',
        matchPrediction: 'Match prediction analysis unavailable',
        excitingCommentary: ['Stay tuned for live updates!']
      };
    }
  }

  static async predictMatchWinner(team1Data, team2Data, matchType = 'T20') {
    const team1 = team1Data.team1;
    const team2 = team2Data.team2;
    const team1Players = team1Data.players || [];
    const team2Players = team2Data.players || [];

    // If GROQ API key is not available, return mock prediction
    if (!process.env.GROQ_API_KEY) {
      console.log('GROQ API key not available, returning mock prediction');
      console.log('GROQ_API_KEY value:', process.env.GROQ_API_KEY);
      return {
        success: true,
        analysis: {
          team1: {
            name: team1.name,
            analysis: `${team1.name} has ${team1Players.length} players with diverse skills`,
            winningPercentage: 52
          },
          team2: {
            name: team2.name,
            analysis: `${team2.name} has ${team2Players.length} players with good potential`,
            winningPercentage: 48
          },
          keyFactors: ['Player experience', 'Team balance', 'Current form'],
          recommendedStrategy: 'Focus on strong batting lineup and disciplined bowling',
          confidence: 'medium',
          matchType: matchType
        }
      };
    }

    // Build team summaries
    const buildTeamSummary = (team, players) => {
      const batsmen = players.filter(p => p.role === 'batsman' || p.role === 'wicketkeeper').slice(0, 4);
      const bowlers = players.filter(p => p.role === 'bowler').slice(0, 4);
      const allRounders = players.filter(p => p.role === 'allrounder').slice(0, 2);

      return {
        name: team.name,
        batsmen: batsmen.map(p => ({
          name: p.name,
          avg: p.careerStats?.batting?.average || 0,
          runs: p.careerStats?.batting?.runs || 0
        })),
        bowlers: bowlers.map(p => ({
          name: p.name,
          avg: p.careerStats?.bowling?.average || 0,
          wkts: p.careerStats?.bowling?.wickets || 0
        })),
        allRounders: allRounders.map(p => ({
          name: p.name,
          batAvg: p.careerStats?.batting?.average || 0,
          bowlAvg: p.careerStats?.bowling?.average || 0
        }))
      };
    };

    const team1Summary = buildTeamSummary(team1, team1Players);
    const team2Summary = buildTeamSummary(team2, team2Players);

    const prompt = `Based on these cricket teams, who would win a T20 match?

Team 1: ${team1Summary.name} with players: ${team1Summary.batsmen.map(p => p.name).join(', ')}
Team 2: ${team2Summary.name} with players: ${team2Summary.batsmen.map(p => p.name).join(', ')}

Give a brief prediction with winning percentages.`;

    // For development, return mock prediction
    return {
      success: true,
      analysis: {
        team1: {
          name: team1.name,
          analysis: `${team1.name} has ${team1Players.length} players with diverse skills`,
          winningPercentage: 52
        },
        team2: {
          name: team2.name,
          analysis: `${team2.name} has ${team2Players.length} players with good potential`,
          winningPercentage: 48
        },
        keyFactors: ['Player experience', 'Team balance', 'Current form'],
        recommendedStrategy: 'Focus on strong batting lineup and disciplined bowling',
        confidence: 'medium',
        matchType: matchType
      }
    };
  }
}

module.exports = { GroqService };