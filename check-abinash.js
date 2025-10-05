const { collections } = require('./config/database');

async function checkAbinashHowOut() {
  try {
    const playersRef = collections.players;
    const snapshot = await playersRef.where('name', '==', 'Abinash Subudhi').get();

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('Player:', data.name);

      if (data.matchHistory && data.matchHistory.length > 0) {
        data.matchHistory.forEach((match, matchIndex) => {
          if (match.contributions && match.contributions.length > 0) {
            match.contributions.forEach((contribution, contribIndex) => {
              if (contribution.type === 'batting' && contribution.howOut) {
                console.log(`Match ${matchIndex + 1}, Contribution ${contribIndex + 1}:`);
                console.log('  Dismissal:', contribution.dismissal);
                console.log('  howOut:', JSON.stringify(contribution.howOut, null, 2));
              }
            });
          }
        });
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkAbinashHowOut();