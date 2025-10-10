#!/usr/bin/env node

/**
 * V2 COLLECTIONS VERIFICATION RUNNER
 *
 * This script verifies that the v2 collections migration was successful
 *
 * Usage: node scripts-v2/run-v2-verification.js
 */

const admin = require('firebase-admin');
const { runV2Verification } = require('./verify-v2-migration');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Load environment variables
  require('dotenv').config();

  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });

  console.log('🔥 Firebase initialized for V2 verification');
}

async function main() {
  console.log('🔍 Starting V2 Collections Verification...\n');

  try {
    await runV2Verification();
    console.log('\n✅ V2 Collections verification completed successfully!');
  } catch (error) {
    console.error('\n❌ V2 Verification failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}