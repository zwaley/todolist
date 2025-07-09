// 测试路由脚本
const http = require('http');

function testRoute(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log(`${path}: ${res.statusCode}`);
      resolve(res.statusCode);
    });

    req.on('error', (err) => {
      console.log(`${path}: ERROR - ${err.message}`);
      resolve(0);
    });

    req.end();
  });
}

async function testAllRoutes() {
  console.log('Testing routes...');
  await testRoute('/');
  await testRoute('/zh');
  await testRoute('/en');
  await testRoute('/zh/login');
  await testRoute('/en/login');
  console.log('Test completed.');
}

testAllRoutes();