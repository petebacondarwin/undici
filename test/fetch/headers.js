'use strict'

const tap = require('tap')
const {
  Headers,
  normalizeAndValidateHeaderName,
  normalizeAndValidateHeaderValue,
  fill
} = require('../../lib/fetch/headers')
const { kGuard } = require('../../lib/fetch/symbols')
const {
  forbiddenHeaderNames,
  forbiddenResponseHeaderNames
} = require('../../lib/fetch/constants')
const { createServer } = require('http')
const { fetch } = require('../../index')

tap.test('Headers initialization', t => {
  t.plan(7)

  t.test('allows undefined', t => {
    t.plan(1)

    t.doesNotThrow(() => new Headers())
  })

  t.test('with array of header entries', t => {
    t.plan(3)

    t.test('fails on invalid array-based init', t => {
      t.plan(3)
      t.throws(() => new Headers([['undici', 'fetch'], ['fetch']]), TypeError())
      t.throws(() => new Headers(['undici', 'fetch', 'fetch']), TypeError())
      t.throws(() => new Headers([0, 1, 2]), TypeError())
    })

    t.test('allows even length init', t => {
      t.plan(1)
      const init = [['undici', 'fetch'], ['fetch', 'undici']]
      t.doesNotThrow(() => new Headers(init))
    })

    t.test('fails for event flattened init', t => {
      t.plan(1)
      const init = ['undici', 'fetch', 'fetch', 'undici']
      t.throws(() => new Headers(init), TypeError())
    })
  })

  t.test('with object of header entries', t => {
    t.plan(1)
    const init = {
      undici: 'fetch',
      fetch: 'undici'
    }
    t.doesNotThrow(() => new Headers(init))
  })

  t.test('fails silently if a boxed primitive object is passed', t => {
    t.plan(3)
    /* eslint-disable no-new-wrappers */
    t.doesNotThrow(() => new Headers(new Number()))
    t.doesNotThrow(() => new Headers(new Boolean()))
    t.doesNotThrow(() => new Headers(new String()))
    /* eslint-enable no-new-wrappers */
  })

  t.test('fails if function or primitive is passed', t => {
    t.plan(4)
    const expectedTypeError = TypeError("Failed to construct 'Headers': The provided value is not of type '(record<ByteString, ByteString> or sequence<sequence<ByteString>>")
    t.throws(() => new Headers(Function), expectedTypeError)
    t.throws(() => new Headers(function () {}), expectedTypeError)
    t.throws(() => new Headers(1), expectedTypeError)
    t.throws(() => new Headers('1'), expectedTypeError)
  })

  t.test('allows a myriad of header values to be passed', t => {
    t.plan(5)

    // Headers constructor uses Headers.append

    t.doesNotThrow(() => new Headers([
      ['a', ['b', 'c']],
      ['d', ['e', 'f']]
    ]), 'allows any array values')
    t.doesNotThrow(() => new Headers([
      ['key', null]
    ]), 'allows null values')
    t.doesNotThrow(() => new Headers([
      ['key', Symbol('undici-fetch')]
    ]), 'allows Symbol values')
    t.throws(() => new Headers([
      ['key']
    ]), 'throws when 2 arguments are not passed')
    t.throws(() => new Headers([
      ['key', 'value', 'value2']
    ]), 'throws when too many arguments are passed')
  })

  t.test('accepts headers as objects with array values', t => {
    t.plan(1)
    const headers = new Headers({
      c: '5',
      b: ['3', '4'],
      a: ['1', '2']
    })

    t.same([...headers.entries()], [
      ['a', '1,2'],
      ['b', '3,4'],
      ['c', '5']
    ])
  })
})

tap.test('Headers append', t => {
  t.plan(3)

  t.test('adds valid header entry to instance', t => {
    t.plan(2)
    const headers = new Headers()

    const name = 'undici'
    const value = 'fetch'
    t.doesNotThrow(() => headers.append(name, value))
    t.equal(headers.get(name), value)
  })

  t.test('adds valid header to existing entry', t => {
    t.plan(4)
    const headers = new Headers()

    const name = 'undici'
    const value1 = 'fetch1'
    const value2 = 'fetch2'
    const value3 = 'fetch3'
    headers.append(name, value1)
    t.equal(headers.get(name), value1)
    t.doesNotThrow(() => headers.append(name, value2))
    t.doesNotThrow(() => headers.append(name, value3))
    t.equal(headers.get(name), [value1, value2, value3].join(', '))
  })

  t.test('throws on invalid entry', t => {
    t.plan(3)
    const headers = new Headers()

    t.throws(() => headers.append(), 'throws on missing name and value')
    t.throws(() => headers.append('undici'), 'throws on missing value')
    t.throws(() => headers.append('invalid @ header ? name', 'valid value'), 'throws on invalid name')
  })
})

tap.test('Headers delete', t => {
  t.plan(3)

  t.test('deletes valid header entry from instance', t => {
    t.plan(3)
    const headers = new Headers()

    const name = 'undici'
    const value = 'fetch'
    headers.append(name, value)
    t.equal(headers.get(name), value)
    t.doesNotThrow(() => headers.delete(name))
    t.equal(headers.get(name), null)
  })

  t.test('does not mutate internal list when no match is found', t => {
    t.plan(3)

    const headers = new Headers()
    const name = 'undici'
    const value = 'fetch'
    headers.append(name, value)
    t.equal(headers.get(name), value)
    t.doesNotThrow(() => headers.delete('not-undici'))
    t.equal(headers.get(name), value)
  })

  t.test('throws on invalid entry', t => {
    t.plan(2)
    const headers = new Headers()

    t.throws(() => headers.delete(), 'throws on missing namee')
    t.throws(() => headers.delete('invalid @ header ? name'), 'throws on invalid name')
  })
})

tap.test('Headers get', t => {
  t.plan(3)

  t.test('returns null if not found in instance', t => {
    t.plan(1)
    const headers = new Headers()
    headers.append('undici', 'fetch')

    t.equal(headers.get('not-undici'), null)
  })

  t.test('returns header values from valid header name', t => {
    t.plan(2)
    const headers = new Headers()

    const name = 'undici'; const value1 = 'fetch1'; const value2 = 'fetch2'
    headers.append(name, value1)
    t.equal(headers.get(name), value1)
    headers.append(name, value2)
    t.equal(headers.get(name), [value1, value2].join(', '))
  })

  t.test('throws on invalid entry', t => {
    t.plan(2)
    const headers = new Headers()

    t.throws(() => headers.get(), 'throws on missing name')
    t.throws(() => headers.get('invalid @ header ? name'), 'throws on invalid name')
  })
})

tap.test('Headers has', t => {
  t.plan(2)

  t.test('returns boolean existence for a header name', t => {
    t.plan(2)
    const headers = new Headers()

    const name = 'undici'
    headers.append('not-undici', 'fetch')
    t.equal(headers.has(name), false)
    headers.append(name, 'fetch')
    t.equal(headers.has(name), true)
  })

  t.test('throws on invalid entry', t => {
    t.plan(2)
    const headers = new Headers()

    t.throws(() => headers.has(), 'throws on missing name')
    t.throws(() => headers.has('invalid @ header ? name'), 'throws on invalid name')
  })
})

tap.test('Headers set', t => {
  t.plan(4)

  t.test('sets valid header entry to instance', t => {
    t.plan(2)
    const headers = new Headers()

    const name = 'undici'
    const value = 'fetch'
    headers.append('not-undici', 'fetch')
    t.doesNotThrow(() => headers.set(name, value))
    t.equal(headers.get(name), value)
  })

  t.test('overwrites existing entry', t => {
    t.plan(4)
    const headers = new Headers()

    const name = 'undici'
    const value1 = 'fetch1'
    const value2 = 'fetch2'
    t.doesNotThrow(() => headers.set(name, value1))
    t.equal(headers.get(name), value1)
    t.doesNotThrow(() => headers.set(name, value2))
    t.equal(headers.get(name), value2)
  })

  t.test('allows setting a myriad of values', t => {
    t.plan(5)
    const headers = new Headers()

    t.doesNotThrow(() => headers.set('a', ['b', 'c']), 'sets array values properly')
    t.doesNotThrow(() => headers.set('b', null), 'allows setting null values')
    t.throws(() => headers.set('c'), 'throws when 2 arguments are not passed')
    t.doesNotThrow(() => headers.set('c', 'd', 'e'), 'ignores extra arguments')
    t.doesNotThrow(() => headers.set('f', Symbol('g'), 'allows Symbol value'))
  })

  t.test('throws on invalid entry', t => {
    t.plan(3)
    const headers = new Headers()

    t.throws(() => headers.set(), 'throws on missing name and value')
    t.throws(() => headers.set('undici'), 'throws on missing value')
    t.throws(() => headers.set('invalid @ header ? name', 'valid value'), 'throws on invalid name')
  })
})

tap.test('Headers forEach', t => {
  const headers = new Headers([['a', 'b'], ['c', 'd']])

  t.test('standard', t => {
    t.equal(typeof headers.forEach, 'function')

    headers.forEach((value, key, headerInstance) => {
      t.ok(value === 'b' || value === 'd')
      t.ok(key === 'a' || key === 'c')
      t.equal(headers, headerInstance)
    })

    t.end()
  })

  t.test('when no thisArg is set, it is globalThis', (t) => {
    headers.forEach(function () {
      t.equal(this, globalThis)
    })

    t.end()
  })

  t.test('with thisArg', t => {
    const thisArg = { a: Math.random() }
    headers.forEach(function () {
      t.equal(this, thisArg)
    }, thisArg)

    t.end()
  })

  t.end()
})

tap.test('Headers as Iterable', t => {
  t.plan(8)

  t.test('should freeze values while iterating', t => {
    t.plan(1)
    const init = [
      ['foo', '123'],
      ['bar', '456']
    ]
    const expected = [
      ['x-bar', '456'],
      ['x-foo', '123']
    ]
    const headers = new Headers(init)
    for (const [key, val] of headers) {
      headers.delete(key)
      headers.set(`x-${key}`, val)
    }
    t.strictSame([...headers], expected)
  })

  t.test('prevent infinite, continuous iteration', t => {
    t.plan(2)

    const headers = new Headers({
      z: 1,
      y: 2,
      x: 3
    })

    const order = []
    for (const [key] of headers) {
      order.push(key)
      headers.append(key + key, 1)
    }

    t.strictSame(order, ['x', 'y', 'z'])
    t.strictSame(
      [...headers.keys()],
      ['x', 'xx', 'y', 'yy', 'z', 'zz']
    )
  })

  t.test('returns combined and sorted entries using .forEach()', t => {
    t.plan(8)
    const init = [
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
      ['abc', '4'],
      ['b', '5']
    ]
    const expected = [
      ['a', '1'],
      ['abc', '4'],
      ['b', '2, 5'],
      ['c', '3']
    ]
    const headers = new Headers(init)
    const that = {}
    let i = 0
    headers.forEach(function (value, key, _headers) {
      t.strictSame(expected[i++], [key, value])
      t.equal(this, that)
    }, that)
  })

  t.test('returns combined and sorted entries using .entries()', t => {
    t.plan(4)
    const init = [
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
      ['abc', '4'],
      ['b', '5']
    ]
    const expected = [
      ['a', '1'],
      ['abc', '4'],
      ['b', '2, 5'],
      ['c', '3']
    ]
    const headers = new Headers(init)
    let i = 0
    for (const header of headers.entries()) {
      t.strictSame(header, expected[i++])
    }
  })

  t.test('returns combined and sorted keys using .keys()', t => {
    t.plan(4)
    const init = [
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
      ['abc', '4'],
      ['b', '5']
    ]
    const expected = ['a', 'abc', 'b', 'c']
    const headers = new Headers(init)
    let i = 0
    for (const key of headers.keys()) {
      t.strictSame(key, expected[i++])
    }
  })

  t.test('returns combined and sorted values using .values()', t => {
    t.plan(4)
    const init = [
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
      ['abc', '4'],
      ['b', '5']
    ]
    const expected = ['1', '4', '2, 5', '3']
    const headers = new Headers(init)
    let i = 0
    for (const value of headers.values()) {
      t.strictSame(value, expected[i++])
    }
  })

  t.test('returns combined and sorted entries using for...of loop', t => {
    t.plan(5)
    const init = [
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
      ['abc', '4'],
      ['b', '5'],
      ['d', ['6', '7']]
    ]
    const expected = [
      ['a', '1'],
      ['abc', '4'],
      ['b', '2, 5'],
      ['c', '3'],
      ['d', '6,7']
    ]
    let i = 0
    for (const header of new Headers(init)) {
      t.strictSame(header, expected[i++])
    }
  })

  t.test('validate append ordering', t => {
    t.plan(1)
    const headers = new Headers([['b', '2'], ['c', '3'], ['e', '5']])
    headers.append('d', '4')
    headers.append('a', '1')
    headers.append('f', '6')
    headers.append('c', '7')
    headers.append('abc', '8')

    const expected = [...new Map([
      ['a', '1'],
      ['abc', '8'],
      ['b', '2'],
      ['c', '3, 7'],
      ['d', '4'],
      ['e', '5'],
      ['f', '6']
    ])]

    t.same([...headers], expected)
  })
})

tap.test('arg validation', (t) => {
  // normalizeAndValidateHeaderName
  t.throws(() => {
    normalizeAndValidateHeaderName()
  }, TypeError)

  // normalizeAndValidateHeaderValue
  t.throws(() => {
    normalizeAndValidateHeaderValue()
  }, TypeError)

  // fill
  t.throws(() => {
    fill({}, 0)
  }, TypeError)

  const headers = new Headers()

  // constructor
  t.throws(() => {
    // eslint-disable-next-line
    new Headers(0)
  }, TypeError)

  // get [Symbol.toStringTag]
  t.doesNotThrow(() => {
    Object.prototype.toString.call(Headers.prototype)
  })

  // toString
  t.doesNotThrow(() => {
    Headers.prototype.toString.call(null)
  })

  // append
  t.throws(() => {
    Headers.prototype.append.call(null)
  }, TypeError)
  t.throws(() => {
    headers.append()
  }, TypeError)

  // delete
  t.throws(() => {
    Headers.prototype.delete.call(null)
  }, TypeError)
  t.throws(() => {
    headers.delete()
  }, TypeError)

  // get
  t.throws(() => {
    Headers.prototype.get.call(null)
  }, TypeError)
  t.throws(() => {
    headers.get()
  }, TypeError)

  // has
  t.throws(() => {
    Headers.prototype.has.call(null)
  }, TypeError)
  t.throws(() => {
    headers.has()
  }, TypeError)

  // set
  t.throws(() => {
    Headers.prototype.set.call(null)
  }, TypeError)
  t.throws(() => {
    headers.set()
  }, TypeError)

  // forEach
  t.throws(() => {
    Headers.prototype.forEach.call(null)
  }, TypeError)
  t.throws(() => {
    headers.forEach()
  }, TypeError)
  t.throws(() => {
    headers.forEach(1)
  }, TypeError)

  // inspect
  t.throws(() => {
    Headers.prototype[Symbol.for('nodejs.util.inspect.custom')].call(null)
  }, TypeError)

  t.end()
})

tap.test('function signature verification', (t) => {
  t.test('function length', (t) => {
    t.equal(Headers.prototype.append.length, 2)
    t.equal(Headers.prototype.constructor.length, 0)
    t.equal(Headers.prototype.delete.length, 1)
    t.equal(Headers.prototype.entries.length, 0)
    t.equal(Headers.prototype.forEach.length, 1)
    t.equal(Headers.prototype.get.length, 1)
    t.equal(Headers.prototype.has.length, 1)
    t.equal(Headers.prototype.keys.length, 0)
    t.equal(Headers.prototype.set.length, 2)
    t.equal(Headers.prototype.values.length, 0)
    t.equal(Headers.prototype[Symbol.iterator].length, 0)
    t.equal(Headers.prototype.toString.length, 0)

    t.end()
  })

  t.test('function equality', (t) => {
    t.equal(Headers.prototype.entries, Headers.prototype[Symbol.iterator])
    t.equal(Headers.prototype.toString, Object.prototype.toString)

    t.end()
  })

  t.test('toString and Symbol.toStringTag', (t) => {
    t.equal(Object.prototype.toString.call(Headers.prototype), '[object Headers]')
    t.equal(Headers.prototype[Symbol.toStringTag], 'Headers')
    t.equal(Headers.prototype.toString.call(null), '[object Null]')

    t.end()
  })

  t.end()
})

tap.test('various init paths of Headers', (t) => {
  const h1 = new Headers()
  const h2 = new Headers({})
  const h3 = new Headers(undefined)
  t.equal([...h1.entries()].length, 0)
  t.equal([...h2.entries()].length, 0)
  t.equal([...h3.entries()].length, 0)

  t.end()
})

tap.test('immutable guard', (t) => {
  const headers = new Headers()
  headers.set('key', 'val')
  headers[kGuard] = 'immutable'

  t.throws(() => {
    headers.set('asd', 'asd')
  })
  t.throws(() => {
    headers.append('asd', 'asd')
  })
  t.throws(() => {
    headers.delete('asd')
  })
  t.equal(headers.get('key'), 'val')
  t.equal(headers.has('key'), true)

  t.end()
})

tap.test('request-no-cors guard', (t) => {
  const headers = new Headers()
  headers[kGuard] = 'request-no-cors'
  t.doesNotThrow(() => { headers.set('key', 'val') })
  t.doesNotThrow(() => { headers.append('key', 'val') })
  t.doesNotThrow(() => { headers.delete('key') })
  t.end()
})

tap.test('request guard', (t) => {
  const headers = new Headers(forbiddenHeaderNames.map(k => [k, 'v']))
  headers[kGuard] = 'request'
  headers.set('set-cookie', 'val')

  for (const name of forbiddenHeaderNames) {
    headers.set(name, '1')
    headers.append(name, '1')
    t.equal(headers.get(name), 'v')
    headers.delete(name)
    t.equal(headers.has(name), true)
  }

  t.equal(headers.get('set-cookie'), 'val')
  t.equal(headers.has('set-cookie'), true)

  t.end()
})

tap.test('response guard', (t) => {
  const headers = new Headers(forbiddenResponseHeaderNames.map(k => [k, 'v']))
  headers[kGuard] = 'response'
  headers.set('key', 'val')
  headers.set('keep-alive', 'val')

  for (const name of forbiddenResponseHeaderNames) {
    headers.set(name, '1')
    headers.append(name, '1')
    t.equal(headers.get(name), 'v')
    headers.delete(name)
    t.equal(headers.has(name), true)
  }

  t.equal(headers.get('keep-alive'), 'val')
  t.equal(headers.has('keep-alive'), true)

  t.end()
})

tap.test('set-cookie[2] in Headers constructor', (t) => {
  const headers = new Headers(forbiddenResponseHeaderNames.map(k => [k, 'v']))

  for (const header of forbiddenResponseHeaderNames) {
    t.ok(headers.has(header))
    t.equal(headers.get(header), 'v')
  }

  t.end()
})

// https://github.com/nodejs/undici/issues/1328
tap.test('set-cookie[2] received from server - issue #1328', (t) => {
  const server = createServer((req, res) => {
    res.setHeader('set-cookie', 'my-cookie; wow')
    res.end('Goodbye!')
  }).unref()
  t.teardown(server.close.bind(server))

  server.listen(0, async () => {
    const { headers } = await fetch(`http://localhost:${server.address().port}`)

    t.notOk(headers.has('set-cookie'))
    t.notOk(headers.has('Set-cookie'))
    t.notOk(headers.has('sEt-CoOkIe'))

    t.equal(headers.get('set-cookie'), null)
    t.equal(headers.get('Set-cookie'), null)
    t.equal(headers.get('sEt-CoOkIe'), null)

    t.end()
  })
})
