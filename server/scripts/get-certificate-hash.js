#!/usr/bin/env node

import https from 'https';
import crypto from 'crypto';

/**
 * Script to get certificate SHA256 hash for certificate pinning
 * Usage: node get-certificate-hash.js <domain>
 */

const domain = process.argv[2];

if (!domain) {
  console.error('Usage: node get-certificate-hash.js <domain>');
  console.error('Example: node get-certificate-hash.js getbrainlift.app');
  process.exit(1);
}

function getCertificateHash(hostname) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      method: 'GET',
      rejectUnauthorized: false // Allow self-signed certificates for testing
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate();
      
      if (!cert || Object.keys(cert).length === 0) {
        reject(new Error('No certificate found'));
        return;
      }

      // Get certificate in DER format
      const der = cert.raw;
      
      // Calculate SHA256 hash
      const hash = crypto.createHash('sha256').update(der).digest('base64');
      
      resolve({
        subject: cert.subject,
        issuer: cert.issuer,
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        fingerprint: cert.fingerprint,
        fingerprint256: cert.fingerprint256,
        sha256Hash: `sha256/${hash}`,
        pinFormat: `'sha256/${hash}='`
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Get certificate chain
function getCertificateChain(hostname) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      method: 'GET',
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate(true); // true = include full chain
      
      const chain = [];
      let current = cert;
      
      while (current && Object.keys(current).length > 0) {
        if (current.raw) {
          const hash = crypto.createHash('sha256').update(current.raw).digest('base64');
          chain.push({
            subject: current.subject?.CN || current.subject?.O || 'Unknown',
            issuer: current.issuer?.CN || current.issuer?.O || 'Unknown',
            sha256Hash: `sha256/${hash}`,
            pinFormat: `'sha256/${hash}='`
          });
        }
        
        // Move to issuer certificate
        current = current.issuerCertificate;
        
        // Prevent infinite loop for self-signed certificates
        if (current === cert || chain.length > 10) break;
      }
      
      resolve(chain);
    });

    req.on('error', reject);
    req.end();
  });
}

// Main execution
async function main() {
  try {
    console.log(`\nGetting certificate information for: ${domain}\n`);
    
    // Get main certificate
    const certInfo = await getCertificateHash(domain);
    console.log('Certificate Information:');
    console.log('------------------------');
    console.log(`Subject: ${JSON.stringify(certInfo.subject)}`);
    console.log(`Issuer: ${JSON.stringify(certInfo.issuer)}`);
    console.log(`Valid From: ${certInfo.validFrom}`);
    console.log(`Valid To: ${certInfo.validTo}`);
    console.log(`\nSHA256 Hash: ${certInfo.sha256Hash}`);
    console.log(`\nFor certificate pinning, use:`);
    console.log(certInfo.pinFormat);
    
    // Get certificate chain
    console.log('\n\nCertificate Chain:');
    console.log('------------------');
    const chain = await getCertificateChain(domain);
    
    chain.forEach((cert, index) => {
      console.log(`\n[${index}] ${cert.subject}`);
      console.log(`    Issuer: ${cert.issuer}`);
      console.log(`    SHA256: ${cert.sha256Hash}`);
      console.log(`    Pin: ${cert.pinFormat}`);
    });
    
    console.log('\n\nRecommended pins for certificate pinning:');
    console.log('----------------------------------------');
    console.log(`Primary (leaf certificate): ${chain[0]?.pinFormat}`);
    if (chain[1]) {
      console.log(`Backup (intermediate CA): ${chain[1]?.pinFormat}`);
    }
    
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();