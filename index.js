const url = require('url')
const $RouteParam = Symbol('RouteParam')
const $ParamName = Symbol('Param')
const $Handlers = Symbol('Handlers')

function App () {
  this.routes = {}
  this.middleware = []
  this.handler = this.handler.bind(this)
}

function traverseTree (tree, segments, method, params = {}) {
  if (segments.length === 0 && tree[$Handlers] && tree[$Handlers][method]) {
    return tree[$Handlers][method]
  }
  const leg = segments[0]
  if (tree[leg]) {
    return traverseTree(tree[leg], segments.slice(1), method, params)
  }
  if (tree[$RouteParam]) {
    const paramName = tree[$ParamName]
    params[paramName] = leg
    return traverseTree(tree[$RouteParam], segments.slice(1), method, params)
  }
  return null
}

function buildTree (tree, segments, method, handler) {
  if (segments.length === 0) {
    tree[$Handlers] = tree[$Handlers] || {}
    tree[$Handlers][method] = handler
  }
  const leg = segments[0]
  if (leg.startsWith(':')) {
    for (let branch in tree) {
      if (typeof branch === 'string' || branch instanceof String) {
        throw new Error(`Ambiguous route: cannot add dynamic route ${leg} where ${branch} already exists`)
      }
    }
    tree[$RouteParam] = tree[$RouteParam] || {}
    tree[$ParamName] = leg.slice(1)
    buildTree(tree[$RouteParam], segments.slice(1), method, handler)
  } else {
    if (tree[$RouteParam]) {
      throw new Error(`Ambiguous route: cannot add static route where dynamic route segment :${tree[$ParamName]} already exists`)
    }   
    tree[leg] = tree[leg] || {}
    buildTree(tree[leg], segments.slice(1), method, handler)
  }
}

App.prototype.addRoute = function (path, method, handler) {
  const segments = path.split('/').slice(1)

  const match = traverseTree(this.route, segments, method)
  if (match) {
    throw new Error(`Ambiguous route: ${path} already defined`)
  }
  buildTree(this.routes, segments, method, handler)
  console.log(this.routes)
}

// ... existing methods ...

module.exports = App

const methods = ['get', 'post', 'put', 'patch', 'delete', 'head']

for (const method of methods) {
  App.prototype[method] = function (path, handler) {
    this.addRoute(path, method.toUpperCase(), handler)
  }
}

App.prototype.handler = function (req, res) {
  console.log(`${req.method} ${req.url}`)
  let promiseChain = Promise.resolve()

  for (const middlewareFunc of this.middleware) {
    promiseChain = promiseChain.then(() => {
      if (!res.finished) {
        return middlewareFunc(req, res)
      }
    })
  }

  promiseChain
    .then(() => {
      const segments = req.url.split('/').slice(1)
      let route = this.routes
      const params = {}

      for (const segment of segments) {
        if (segment in route) {
          route = route[segment]
        } else if ($RouteParam in route) {
          params[route[$RouteParam][$ParamName]] = segment
          route = route[$RouteParam]
        } else {
          res.writeHead(404)
          res.end('Not Found')
          return
        }
      }
      if (route[$Handlers]) {
        if (route[$Handlers][req.method]) {
          if (Object.keys(params).length !== 0) {
            req.params = params
          }
          route[$Handlers][req.method](req, res)
        } else {
          res.writeHead(405)
          res.end('Method not allowed')
        }
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })
    .catch(err => {
      if (!res.finished) {
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    })
}

App.queryParser = function () {
  this.use((req) => {
    req.query = url.parse(req.url, true).query
    return Promise.resolve()
  })
}

module.exports = App
