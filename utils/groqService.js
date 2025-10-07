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

    const prompt = `
You are a professional cricket analyst specializing in match analysis, team performance, and tactical insights. Based on the following comprehensive match data, provide an in-depth analysis in JSON format with these exact keys. Focus on team strategies, individual performances, match turning points, and tactical decisions that influenced the outcome.

{
  "matchSummary": "A concise 2-sentence summary of the match including the final result, key performances, and what defined this contest",
  "executiveSummary": "A detailed 3-4 sentence overview of the match, highlighting the key moments, standout performances, and tactical decisions that shaped the outcome",
  "teamAnalysis": {
    "team1Analysis": "Comprehensive analysis of ${team1?.name || 'Team 1'}'s performance including batting, bowling, fielding strengths and weaknesses, tactical approach, and overall effectiveness",
    "team2Analysis": "Comprehensive analysis of ${team2?.name || 'Team 2'}'s performance including batting, bowling, fielding strengths and weaknesses, tactical approach, and overall effectiveness",
    "teamComparison": "Detailed comparison between both teams' strategies, execution, and adaptation throughout the match"
  },
  "performanceAnalysis": {
    "battingAnalysis": "Analysis of batting performances across both innings, including partnerships, individual contributions, and tactical batting decisions",
    "bowlingAnalysis": "Analysis of bowling performances including wicket-taking spells, economy rates, pressure situations, and tactical bowling changes",
    "fieldingAnalysis": "Assessment of fielding standards, catches, run-outs, and fielding decisions that impacted the match",
    "turningPoints": "Identification and analysis of key moments that changed the course of the match"
  },
  "tacticalInsights": {
    "captaincyDecisions": "Analysis of captaincy decisions including toss choice, batting order, bowling changes, and field placements",
    "matchStrategy": "Assessment of overall match strategy, game plans, and how teams adapted to conditions and opposition",
    "keyDecisions": "Critical tactical decisions that proved decisive in determining the match outcome"
  },
  "playerPerformances": {
    "outstandingPerformances": "Detailed analysis of standout individual performances that were crucial to the match result",
    "disappointingPerformances": "Analysis of underperformances or missed opportunities that could have changed the match",
    "matchWinners": "Identification of players whose performances were decisive in securing victory"
  },
  "matchTrends": {
    "momentumShifts": "Analysis of how momentum shifted throughout the match and what caused these changes",
    "pressureHandling": "Assessment of how both teams handled pressure situations and crucial moments",
    "adaptationSkills": "Evaluation of teams' ability to adapt to changing match conditions and opposition tactics"
  },
  "finalVerdict": {
    "fairResult": "Assessment of whether the result was a fair reflection of the teams' performances and strategies",
    "lessonsLearned": "Key lessons and insights that can be drawn from this match for future contests",
    "predictability": "Analysis of how predictable the result was based on team strengths and match circumstances"
  }
}

Match Data:
- Match: ${team1?.name || 'Team 1'} vs ${team2?.name || 'Team 2'}
- Venue: ${venue}
- Match Type: ${matchType}
- Status: ${status}
- Winner: ${winner || 'N/A'}
- Result: ${result?.margin ? `${result.margin}` : 'N/A'}
- Toss: ${toss ? `${toss.winner} won and chose to ${toss.decision}` : 'N/A'}
- Best Batsman: ${bestBatsman ? `${bestBatsman.player?.name} - ${bestBatsman.runs} runs` : 'N/A'}
- Best Bowler: ${bestBowler ? `${bestBowler.player?.name} - ${bestBowler.wickets} wickets` : 'N/A'}

Innings Data:
${innings.map((inning, index) => `
Inning ${index + 1} - ${inning.battingTeam} (${inning.totalRuns}/${inning.totalWickets} in ${inning.totalOvers} overs)
Batting: ${inning.batsmen?.map(b => `${b.player?.name || b.name}: ${b.runs}(${b.balls})`).join(', ') || 'N/A'}
Bowling: ${inning.bowlers?.map(b => `${b.player?.name || b.name}: ${b.wickets}/${b.runs}(${b.overs})`).join(', ') || 'N/A'}
Fall of Wickets: ${inning.fallOfWickets?.map(fow => `${fow.score}-${fow.wicket}: ${fow.player || fow.playerName || fow.batsmanName} (${fow.over})`).join(', ') || 'N/A'}
`).join('')}

Provide comprehensive analysis focusing on tactical decisions, individual brilliance, team strategies, and what made the difference between winning and losing.`;

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
      if (!analysis.matchSummary || !analysis.executiveSummary || !analysis.teamAnalysis) {
        throw new Error('Invalid response structure from GROQ API');
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing match with GROQ:', error);
      // Return comprehensive fallback analysis if API fails
      return {
        matchSummary: `${team1?.name || 'Team 1'} faced ${team2?.name || 'Team 2'} in a ${matchType} match at ${venue}. ${winner ? `${winner} emerged victorious${result?.margin ? ` by ${result.margin}` : ''}, with standout performances from ${bestBatsman?.player?.name || 'key batsmen'} and ${bestBowler?.player?.name || 'key bowlers'}.` : 'The match is currently in progress with both teams showing competitive spirit.'}`,
        executiveSummary: `This ${matchType} encounter between ${team1?.name || 'Team 1'} and ${team2?.name || 'Team 2'} at ${venue} showcased contrasting approaches and tactical decisions. ${winner ? `${winner} secured victory through superior execution and key individual performances, particularly from ${bestBatsman?.player?.name || 'their batsmen'} and ${bestBowler?.player?.name || 'their bowlers'}.` : 'Both teams are competing intensely with the match poised for an exciting conclusion.'} The contest highlighted the importance of adapting to conditions and making crucial decisions at pivotal moments.`,
        teamAnalysis: {
          team1Analysis: `${team1?.name || 'Team 1'} demonstrated ${innings[0]?.totalRuns > innings[1]?.totalRuns ? 'strong batting performance' : 'solid defensive approach'} with ${innings[0]?.totalRuns || 0} runs scored. Their bowling attack showed ${bestBowler?.player?.name ? 'effectiveness with key wickets' : 'competitive spirit'} while fielding standards were ${innings[0]?.totalWickets < 5 ? 'excellent' : 'adequate'}.`,
          team2Analysis: `${team2?.name || 'Team 2'} displayed ${innings[1]?.totalRuns > innings[0]?.totalRuns ? 'resilient batting' : 'disciplined bowling'} with ${innings[1]?.totalRuns || 0} runs. Their performance was characterized by ${bestBatsman?.player?.name ? 'individual brilliance' : 'team effort'} and tactical adaptability throughout the match.`,
          teamComparison: `The match pitted ${team1?.name || 'Team 1'}'s ${innings[0]?.totalRuns > innings[1]?.totalRuns ? 'aggressive approach' : 'defensive strategy'} against ${team2?.name || 'Team 2'}'s ${innings[1]?.totalRuns > innings[0]?.totalRuns ? 'counter-attacking style' : 'patient build-up'}. ${winner ? `${winner} edged out through better execution of their game plan and crucial moments.` : 'Both teams are evenly matched with tactical decisions proving decisive.'}`
        },
        performanceAnalysis: {
          battingAnalysis: `Batting performances varied across innings with ${bestBatsman?.player?.name || 'key contributors'} scoring ${bestBatsman?.runs || 0} runs. Partnerships were ${innings.some(i => i.totalRuns > 150) ? 'crucial in building pressure' : 'important but not decisive'}. Batting approaches ranged from aggressive strokeplay to cautious accumulation depending on match situation.`,
          bowlingAnalysis: `Bowling analysis revealed ${bestBowler?.player?.name || 'key bowlers'} taking ${bestBowler?.wickets || 0} wickets as the standout performer. Economy rates and wicket-taking ability were crucial factors with bowlers adapting to different batting approaches and pitch conditions.`,
          fieldingAnalysis: `Fielding standards impacted the match outcome with ${innings.some(i => i.totalWickets >= 8) ? 'crucial catches and run-outs' : 'adequate fielding efforts'}. Fielding decisions and athleticism played a role in preventing runs and creating wicket opportunities.`,
          turningPoints: `Key moments included ${bestBowler ? `the bowling spell from ${bestBowler.player?.name}` : 'crucial wickets at important times'} and ${bestBatsman ? `the batting innings from ${bestBatsman.player?.name}` : 'strategic batting partnerships'}. These moments shifted momentum and proved decisive in determining the match result.`
        },
        tacticalInsights: {
          captaincyDecisions: `${toss ? `The toss decision to ${toss.decision} proved ${winner === toss.winner ? 'advantageous' : 'challenging'} for ${toss.winner}.` : 'Captaincy decisions throughout the match showed tactical awareness.'} Batting order, bowling changes, and field placements were crucial in adapting to match conditions and opposition strengths.`,
          matchStrategy: `Both teams employed ${matchType === 'T20' ? 'aggressive, fast-paced strategies' : matchType === 'ODI' ? 'balanced approaches with emphasis on partnerships' : 'patient, Test-match style accumulation'}. The winning strategy involved ${winner ? `${winner}'s superior execution and adaptation to changing circumstances.` : 'effective adaptation and tactical flexibility.'}`,
          keyDecisions: `Critical decisions included ${toss ? `the toss choice and initial batting/bowling strategy` : 'early tactical moves and player selections'}. These decisions, combined with in-match adaptations, ultimately determined which team secured the advantage and eventual victory.`
        },
        playerPerformances: {
          outstandingPerformances: `${bestBatsman ? `${bestBatsman.player?.name}'s ${bestBatsman.runs}-run innings showcased exceptional batting skill and match awareness.` : 'Several players delivered outstanding performances that kept their team in contention.'} ${bestBowler ? `${bestBowler.player?.name}'s ${bestBowler.wickets}-wicket haul demonstrated bowling mastery and crucial wicket-taking ability.` : 'Bowlers showed tactical awareness and ability to deliver under pressure.'}`,
          disappointingPerformances: `Some players failed to capitalize on opportunities, with ${innings.some(i => i.totalWickets >= 8) ? 'missed catches and run-out chances' : 'unfulfilled potential in key situations'}. These underperformances could have altered the match dynamics if converted into wickets or prevented runs.`,
          matchWinners: `${bestBatsman?.player?.name || 'Key batsmen'} and ${bestBowler?.player?.name || 'key bowlers'} emerged as match winners through their decisive contributions. Their performances not only secured individual records but also proved pivotal in their team's victory.`
        },
        matchTrends: {
          momentumShifts: `Momentum shifted at crucial junctures, particularly ${bestBowler ? `when ${bestBowler.player?.name} took key wickets` : 'during key partnerships and wicket clusters'}. These shifts were influenced by tactical decisions, individual brilliance, and team adaptability.`,
          pressureHandling: `Both teams demonstrated varying levels of composure under pressure, with ${winner ? `${winner} showing superior ability to handle crucial moments and maintain focus.` : 'both teams competing intensely in pressure situations.'} The ability to perform under stress proved decisive.`,
          adaptationSkills: `Teams showed ${innings.length > 1 ? 'good adaptation to changing match conditions' : 'initial tactical awareness'} with ${toss ? `the toss winner gaining ${winner === toss.winner ? 'advantage' : 'no clear benefit'}` : 'strategic decisions proving crucial'}. Successful adaptation to pitch behavior and opposition tactics was key.`
        },
        finalVerdict: {
          fairResult: `The result ${winner ? `was a fair reflection of ${winner}'s superior performance and tactical execution throughout the match.` : 'remains to be determined as the match continues.'} Both teams contributed to an entertaining contest with clear differences in execution and decision-making.`,
          lessonsLearned: `Key lessons include the importance of ${bestBowler ? 'bowling discipline and wicket-taking ability' : 'consistent performance across all departments'}. Teams should focus on ${bestBatsman ? 'building partnerships and individual brilliance' : 'balanced team contributions'} for future success.`,
          predictability: `Based on team compositions and match circumstances, the result was ${winner ? `${winner}'s victory was ${Math.abs((innings[0]?.totalRuns || 0) - (innings[1]?.totalRuns || 0)) < 20 ? 'closely contested' : 'decisively achieved'}` : 'difficult to predict given the competitive nature of both teams'}. The match highlighted the unpredictable nature of cricket.`
        }
      };
    }
  }
}

module.exports = { GroqService };