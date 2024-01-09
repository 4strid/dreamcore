const http = require('http')

const test = require('tape');
const request = require('request-promise-native');
const App = require('../'); // Adjust the path to your framework

const app = new App();
const HELLO = 'Hello, Dreamline!';
const server = http.createServer(app.handler).listen(7777);

test('GET /test1 returns correct message', async t => {
  app.get('/test1', (req, res) => {
    res.end(HELLO);
  });

  try {
    const body = await request('http://localhost:7777/test1');
    t.equal(body, HELLO, 'GET /test1 should return the correct message');
  } catch (error) {
    t.fail('Request failed: ' + error.message);
  } finally {
    t.end();
  }
})

test('GET returns a 404 for nonexistant path', async t => {
  try {
    await request('http://localhost:7777/badpath')
    t.fail('Successful response where an error was expected')
  } catch (error) {
    t.equal(error.statusCode, 404, 'Server returned a 404 error')
  } finally {
    t.end();
  }
})

test('GET /test2/:routeParam returns correct route parameter', async t => {
  const value = 'foobar';

  app.get('/test2/:routeParam', (req, res) => {
    res.end(req.params.routeParam);
  });

  try {
    const body = await request(`http://localhost:7777/test2/${value}`);
    t.equal(body, value, 'GET /test2/:routeParam should return the correct value');
  } catch (error) {
    t.fail('Request failed: ' + error.message);
  } finally {
    t.end();
  }
});

test('Close server', t => {
  server.close();
  t.pass('Server closed');
  t.end();
});
