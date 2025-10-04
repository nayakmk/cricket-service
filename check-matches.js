const { collections } = require('./config/database');const { collections } = require('./config/database');const { collections } = require('./config/database');



async function checkMatchesQuery() {

  try {

    console.log('Testing matches query...');async function checkMatchesQuery() {async function checkMatchStatuses() {

    const snapshot = await collections.matches.orderBy('createdAt', 'desc').get();

    console.log(`Query returned ${snapshot.docs.length} matches`);  try {  try {



    snapshot.docs.forEach((doc, index) => {    console.log('Testing matches query...');    const matchesSnapshot = await collections.matches.get();

      const matchData = doc.data();

      console.log(`${index + 1}. ${doc.id}: status='${matchData.status}'`);    const snapshot = await collections.matches.orderBy('createdAt', 'desc').get();    console.log('Total matches:', matchesSnapshot.size);

    });

  } catch (error) {    console.log(`Query returned ${snapshot.docs.length} matches`);

    console.error('Error:', error);

  } finally {    matchesSnapshot.forEach(doc => {

    process.exit(0);

  }    snapshot.docs.forEach((doc, index) => {      const data = doc.data();

}

      const data = doc.data();      console.log(`Match ${doc.id}: status='${data.status}', team1Id='${data.team1Id}', team2Id='${data.team2Id}'`);

checkMatchesQuery();
      console.log(`${index + 1}. ${doc.id}: status='${data.status}'`);    });

    });  } catch (error) {

  } catch (error) {    console.error('Error:', error);

    console.error('Error:', error);  } finally {

  } finally {    process.exit(0);

    process.exit(0);  }

  }}

}

checkMatchStatuses();
checkMatchesQuery();