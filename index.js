const url = require('url')
const $RouteParam = Symbol('RouteParam')
const $Param = Symbol('Param')
const $Handlers = Symbol('Handlers')

function App () {
  this.routes = {}
  this.middleware = []
  this.handler = this.handler.bind(this)
}

App.prototype.addRoute = function (method, path, handler) {
  const segments = path.split('/').filter(Boolean)
  let route = this.routes

  segments.forEach((segment, index) => {
    const isLastSegment = index === segments.length - 1
    const leg = segment.startsWith(':') ? $RouteParam : segment

    if (!route[leg]) {
      route[leg] = {}
    }

    if (leg === $RouteParam) {
      route[leg][$Param] = segment.substring(1)
    }

    if (isLastSegment) {
      if (leg === $RouteParam) {
                // Check for existing siblings with handlers
        for (const key in route) {
          if (route[key][$Handlers]) {
            throw new Error(`Ambiguous route: cannot combine dynamic segment '${segments[index]}' with existing static routes under '${segments.slice(0, index).join('/')}'`)
          }
        }
      } else if (route[$RouteParam] && route[$RouteParam][$Handlers]) {
                // Check for existing dynamic route in the parent
        throw new Error(`Ambiguous route: cannot combine static segment '${segment}' with existing dynamic route under '${segments.slice(0, index).join('/')}'`)
      }

      if (!route[leg][$Handlers]) {
        route[leg][$Handlers] = {}
      }
      if (route[leg][$Handlers][method]) {
        throw new Error(`Route for ${path} already defined`)
      }
      route[leg][$Handlers][method] = handler
    } else {
      route = route[leg]
    }
  })
  console.log(this.routes)
}

// ... existing methods ...

module.exports = App

const methods = ['get', 'post', 'put', 'patch', 'delete', 'head']

for (const method of methods) {
  App.prototype[method] = function (path, handler) {
    this.addRoute(method.toUpperCase(), path, handler)
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
      const segments = req.url.split('/').filter(Boolean)
      let route = this.routes
      const params = {}

      for (const segment of segments) {
        if (segment in route) {
          route = route[segment]
        } else if ($RouteParam in route) {
          params[route[$RouteParam][$Param]] = segment
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
