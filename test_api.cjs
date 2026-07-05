const https = require('https');

const data = JSON.stringify({ message: "Hola", nivel: "Semilla", history: [] });

const options = {
  hostname: 'www.vetayvigor.com',
  port: 443,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  console.log('headers:', res.headers);
  let body = '';
  res.on('data', (d) => {
    body += d;
  });
  res.on('end', () => {
    console.log('body:', body);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
