// Check match document structure
const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function checkMatchStructure() {
  try {
    const snapshot = await db.collection(V2_COLLECTIONS.MATCHES).limit(5).get();
    console.log('Match document IDs and data:');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('Document ID:', doc.id);
      console.log('numericId:', data.numericId, 'type:', typeof data.numericId);
      console.log('displayId:', data.displayId, 'type:', typeof data.displayId);
      console.log('status:', data.status);
      console.log('---');
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

checkMatchStructure();