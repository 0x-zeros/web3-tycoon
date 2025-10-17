System.register([], (function (exports) {
  'use strict';
  return {
    execute: (function () {

      exports({
        DEPRECATED_getWallets: DEPRECATED_getWallets,
        DEPRECATED_registerWallet: DEPRECATED_registerWallet,
        arraysEqual: arraysEqual,
        bytesEqual: bytesEqual,
        coinWithBalance: coinWithBalance,
        concatBytes: concatBytes,
        deriveDynamicFieldID: deriveDynamicFieldID,
        deriveObjectID: deriveObjectID,
        formatAddress: formatAddress,
        formatDigest: formatDigest,
        fromBase64: fromBase64,
        fromHex: fromHex,
        getFaucetHost: getFaucetHost,
        getFaucetRequestStatus: getFaucetRequestStatus,
        getFullnodeUrl: getFullnodeUrl,
        getPureBcsSchema: getPureBcsSchema,
        getWallets: getWallets,
        guard: guard,
        isArgument: isArgument,
        isSuiChain: isSuiChain,
        isSuiClient: isSuiJsonRpcClient,
        isTransaction: isTransaction,
        isValidSuiAddress: isValidSuiAddress,
        isValidSuiNSName: isValidSuiNSName,
        isValidSuiObjectId: isValidSuiObjectId,
        isValidTransactionDigest: isValidTransactionDigest,
        isWalletStandardError: isWalletStandardError,
        isWalletWithRequiredFeatureSet: isWalletWithRequiredFeatureSet,
        normalizeStructTag: normalizeStructTag,
        normalizeSuiAddress: normalizeSuiAddress,
        normalizeSuiNSName: normalizeSuiNSName,
        normalizeSuiObjectId: normalizeSuiObjectId,
        normalizedTypeToMoveTypeSignature: normalizedTypeToMoveTypeSignature,
        parseStructTag: parseStructTag,
        pick: pick,
        pureBcsSchemaFromTypeName: pureBcsSchemaFromTypeName,
        registerWallet: registerWallet,
        requestSuiFromFaucetV0: requestSuiFromFaucetV0,
        requestSuiFromFaucetV1: requestSuiFromFaucetV1,
        requestSuiFromFaucetV2: requestSuiFromFaucetV2,
        safeCaptureStackTrace: safeCaptureStackTrace,
        signAndExecuteTransaction: signAndExecuteTransaction,
        signTransaction: signTransaction,
        toBase64: toBase64,
        toHex: toHex
      });

      var buffer = {};

      var base64Js = {};

      var hasRequiredBase64Js;

      function requireBase64Js () {
      	if (hasRequiredBase64Js) return base64Js;
      	hasRequiredBase64Js = 1;

      	base64Js.byteLength = byteLength;
      	base64Js.toByteArray = toByteArray;
      	base64Js.fromByteArray = fromByteArray;

      	var lookup = [];
      	var revLookup = [];
      	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

      	var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      	for (var i = 0, len = code.length; i < len; ++i) {
      	  lookup[i] = code[i];
      	  revLookup[code.charCodeAt(i)] = i;
      	}

      	// Support decoding URL-safe base64 strings, as Node.js does.
      	// See: https://en.wikipedia.org/wiki/Base64#URL_applications
      	revLookup['-'.charCodeAt(0)] = 62;
      	revLookup['_'.charCodeAt(0)] = 63;

      	function getLens (b64) {
      	  var len = b64.length;

      	  if (len % 4 > 0) {
      	    throw new Error('Invalid string. Length must be a multiple of 4')
      	  }

      	  // Trim off extra bytes after placeholder bytes are found
      	  // See: https://github.com/beatgammit/base64-js/issues/42
      	  var validLen = b64.indexOf('=');
      	  if (validLen === -1) validLen = len;

      	  var placeHoldersLen = validLen === len
      	    ? 0
      	    : 4 - (validLen % 4);

      	  return [validLen, placeHoldersLen]
      	}

      	// base64 is 4/3 + up to two characters of the original data
      	function byteLength (b64) {
      	  var lens = getLens(b64);
      	  var validLen = lens[0];
      	  var placeHoldersLen = lens[1];
      	  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
      	}

      	function _byteLength (b64, validLen, placeHoldersLen) {
      	  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
      	}

      	function toByteArray (b64) {
      	  var tmp;
      	  var lens = getLens(b64);
      	  var validLen = lens[0];
      	  var placeHoldersLen = lens[1];

      	  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

      	  var curByte = 0;

      	  // if there are placeholders, only get up to the last complete 4 chars
      	  var len = placeHoldersLen > 0
      	    ? validLen - 4
      	    : validLen;

      	  var i;
      	  for (i = 0; i < len; i += 4) {
      	    tmp =
      	      (revLookup[b64.charCodeAt(i)] << 18) |
      	      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      	      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      	      revLookup[b64.charCodeAt(i + 3)];
      	    arr[curByte++] = (tmp >> 16) & 0xFF;
      	    arr[curByte++] = (tmp >> 8) & 0xFF;
      	    arr[curByte++] = tmp & 0xFF;
      	  }

      	  if (placeHoldersLen === 2) {
      	    tmp =
      	      (revLookup[b64.charCodeAt(i)] << 2) |
      	      (revLookup[b64.charCodeAt(i + 1)] >> 4);
      	    arr[curByte++] = tmp & 0xFF;
      	  }

      	  if (placeHoldersLen === 1) {
      	    tmp =
      	      (revLookup[b64.charCodeAt(i)] << 10) |
      	      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      	      (revLookup[b64.charCodeAt(i + 2)] >> 2);
      	    arr[curByte++] = (tmp >> 8) & 0xFF;
      	    arr[curByte++] = tmp & 0xFF;
      	  }

      	  return arr
      	}

      	function tripletToBase64 (num) {
      	  return lookup[num >> 18 & 0x3F] +
      	    lookup[num >> 12 & 0x3F] +
      	    lookup[num >> 6 & 0x3F] +
      	    lookup[num & 0x3F]
      	}

      	function encodeChunk (uint8, start, end) {
      	  var tmp;
      	  var output = [];
      	  for (var i = start; i < end; i += 3) {
      	    tmp =
      	      ((uint8[i] << 16) & 0xFF0000) +
      	      ((uint8[i + 1] << 8) & 0xFF00) +
      	      (uint8[i + 2] & 0xFF);
      	    output.push(tripletToBase64(tmp));
      	  }
      	  return output.join('')
      	}

      	function fromByteArray (uint8) {
      	  var tmp;
      	  var len = uint8.length;
      	  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
      	  var parts = [];
      	  var maxChunkLength = 16383; // must be multiple of 3

      	  // go through the array every three bytes, we'll deal with trailing stuff later
      	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      	    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
      	  }

      	  // pad the end with zeros, but make sure to not forget the extra bytes
      	  if (extraBytes === 1) {
      	    tmp = uint8[len - 1];
      	    parts.push(
      	      lookup[tmp >> 2] +
      	      lookup[(tmp << 4) & 0x3F] +
      	      '=='
      	    );
      	  } else if (extraBytes === 2) {
      	    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
      	    parts.push(
      	      lookup[tmp >> 10] +
      	      lookup[(tmp >> 4) & 0x3F] +
      	      lookup[(tmp << 2) & 0x3F] +
      	      '='
      	    );
      	  }

      	  return parts.join('')
      	}
      	return base64Js;
      }

      var ieee754 = {};

      /*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */

      var hasRequiredIeee754;

      function requireIeee754 () {
      	if (hasRequiredIeee754) return ieee754;
      	hasRequiredIeee754 = 1;
      	ieee754.read = function (buffer, offset, isLE, mLen, nBytes) {
      	  var e, m;
      	  var eLen = (nBytes * 8) - mLen - 1;
      	  var eMax = (1 << eLen) - 1;
      	  var eBias = eMax >> 1;
      	  var nBits = -7;
      	  var i = isLE ? (nBytes - 1) : 0;
      	  var d = isLE ? -1 : 1;
      	  var s = buffer[offset + i];

      	  i += d;

      	  e = s & ((1 << (-nBits)) - 1);
      	  s >>= (-nBits);
      	  nBits += eLen;
      	  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

      	  m = e & ((1 << (-nBits)) - 1);
      	  e >>= (-nBits);
      	  nBits += mLen;
      	  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

      	  if (e === 0) {
      	    e = 1 - eBias;
      	  } else if (e === eMax) {
      	    return m ? NaN : ((s ? -1 : 1) * Infinity)
      	  } else {
      	    m = m + Math.pow(2, mLen);
      	    e = e - eBias;
      	  }
      	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
      	};

      	ieee754.write = function (buffer, value, offset, isLE, mLen, nBytes) {
      	  var e, m, c;
      	  var eLen = (nBytes * 8) - mLen - 1;
      	  var eMax = (1 << eLen) - 1;
      	  var eBias = eMax >> 1;
      	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
      	  var i = isLE ? 0 : (nBytes - 1);
      	  var d = isLE ? 1 : -1;
      	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

      	  value = Math.abs(value);

      	  if (isNaN(value) || value === Infinity) {
      	    m = isNaN(value) ? 1 : 0;
      	    e = eMax;
      	  } else {
      	    e = Math.floor(Math.log(value) / Math.LN2);
      	    if (value * (c = Math.pow(2, -e)) < 1) {
      	      e--;
      	      c *= 2;
      	    }
      	    if (e + eBias >= 1) {
      	      value += rt / c;
      	    } else {
      	      value += rt * Math.pow(2, 1 - eBias);
      	    }
      	    if (value * c >= 2) {
      	      e++;
      	      c /= 2;
      	    }

      	    if (e + eBias >= eMax) {
      	      m = 0;
      	      e = eMax;
      	    } else if (e + eBias >= 1) {
      	      m = ((value * c) - 1) * Math.pow(2, mLen);
      	      e = e + eBias;
      	    } else {
      	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      	      e = 0;
      	    }
      	  }

      	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

      	  e = (e << mLen) | m;
      	  eLen += mLen;
      	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

      	  buffer[offset + i - d] |= s * 128;
      	};
      	return ieee754;
      }

      /*!
       * The buffer module from node.js, for the browser.
       *
       * @author   Feross Aboukhadijeh <https://feross.org>
       * @license  MIT
       */

      var hasRequiredBuffer;

      function requireBuffer () {
      	if (hasRequiredBuffer) return buffer;
      	hasRequiredBuffer = 1;
      	(function (exports) {

      		const base64 = requireBase64Js();
      		const ieee754 = requireIeee754();
      		const customInspectSymbol =
      		  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
      		    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
      		    : null;

      		exports.Buffer = Buffer;
      		exports.SlowBuffer = SlowBuffer;
      		exports.INSPECT_MAX_BYTES = 50;

      		const K_MAX_LENGTH = 0x7fffffff;
      		exports.kMaxLength = K_MAX_LENGTH;

      		/**
      		 * If `Buffer.TYPED_ARRAY_SUPPORT`:
      		 *   === true    Use Uint8Array implementation (fastest)
      		 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
      		 *               implementation (most compatible, even IE6)
      		 *
      		 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
      		 * Opera 11.6+, iOS 4.2+.
      		 *
      		 * We report that the browser does not support typed arrays if the are not subclassable
      		 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
      		 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
      		 * for __proto__ and has a buggy typed array implementation.
      		 */
      		Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();

      		if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
      		    typeof console.error === 'function') {
      		  console.error(
      		    'This browser lacks typed array (Uint8Array) support which is required by ' +
      		    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
      		  );
      		}

      		function typedArraySupport () {
      		  // Can typed array instances can be augmented?
      		  try {
      		    const arr = new Uint8Array(1);
      		    const proto = { foo: function () { return 42 } };
      		    Object.setPrototypeOf(proto, Uint8Array.prototype);
      		    Object.setPrototypeOf(arr, proto);
      		    return arr.foo() === 42
      		  } catch (e) {
      		    return false
      		  }
      		}

      		Object.defineProperty(Buffer.prototype, 'parent', {
      		  enumerable: true,
      		  get: function () {
      		    if (!Buffer.isBuffer(this)) return undefined
      		    return this.buffer
      		  }
      		});

      		Object.defineProperty(Buffer.prototype, 'offset', {
      		  enumerable: true,
      		  get: function () {
      		    if (!Buffer.isBuffer(this)) return undefined
      		    return this.byteOffset
      		  }
      		});

      		function createBuffer (length) {
      		  if (length > K_MAX_LENGTH) {
      		    throw new RangeError('The value "' + length + '" is invalid for option "size"')
      		  }
      		  // Return an augmented `Uint8Array` instance
      		  const buf = new Uint8Array(length);
      		  Object.setPrototypeOf(buf, Buffer.prototype);
      		  return buf
      		}

      		/**
      		 * The Buffer constructor returns instances of `Uint8Array` that have their
      		 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
      		 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
      		 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
      		 * returns a single octet.
      		 *
      		 * The `Uint8Array` prototype remains unmodified.
      		 */

      		function Buffer (arg, encodingOrOffset, length) {
      		  // Common case.
      		  if (typeof arg === 'number') {
      		    if (typeof encodingOrOffset === 'string') {
      		      throw new TypeError(
      		        'The "string" argument must be of type string. Received type number'
      		      )
      		    }
      		    return allocUnsafe(arg)
      		  }
      		  return from(arg, encodingOrOffset, length)
      		}

      		Buffer.poolSize = 8192; // not used by this implementation

      		function from (value, encodingOrOffset, length) {
      		  if (typeof value === 'string') {
      		    return fromString(value, encodingOrOffset)
      		  }

      		  if (ArrayBuffer.isView(value)) {
      		    return fromArrayView(value)
      		  }

      		  if (value == null) {
      		    throw new TypeError(
      		      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      		      'or Array-like Object. Received type ' + (typeof value)
      		    )
      		  }

      		  if (isInstance(value, ArrayBuffer) ||
      		      (value && isInstance(value.buffer, ArrayBuffer))) {
      		    return fromArrayBuffer(value, encodingOrOffset, length)
      		  }

      		  if (typeof SharedArrayBuffer !== 'undefined' &&
      		      (isInstance(value, SharedArrayBuffer) ||
      		      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
      		    return fromArrayBuffer(value, encodingOrOffset, length)
      		  }

      		  if (typeof value === 'number') {
      		    throw new TypeError(
      		      'The "value" argument must not be of type number. Received type number'
      		    )
      		  }

      		  const valueOf = value.valueOf && value.valueOf();
      		  if (valueOf != null && valueOf !== value) {
      		    return Buffer.from(valueOf, encodingOrOffset, length)
      		  }

      		  const b = fromObject(value);
      		  if (b) return b

      		  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      		      typeof value[Symbol.toPrimitive] === 'function') {
      		    return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length)
      		  }

      		  throw new TypeError(
      		    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      		    'or Array-like Object. Received type ' + (typeof value)
      		  )
      		}

      		/**
      		 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
      		 * if value is a number.
      		 * Buffer.from(str[, encoding])
      		 * Buffer.from(array)
      		 * Buffer.from(buffer)
      		 * Buffer.from(arrayBuffer[, byteOffset[, length]])
      		 **/
      		Buffer.from = function (value, encodingOrOffset, length) {
      		  return from(value, encodingOrOffset, length)
      		};

      		// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
      		// https://github.com/feross/buffer/pull/148
      		Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
      		Object.setPrototypeOf(Buffer, Uint8Array);

      		function assertSize (size) {
      		  if (typeof size !== 'number') {
      		    throw new TypeError('"size" argument must be of type number')
      		  } else if (size < 0) {
      		    throw new RangeError('The value "' + size + '" is invalid for option "size"')
      		  }
      		}

      		function alloc (size, fill, encoding) {
      		  assertSize(size);
      		  if (size <= 0) {
      		    return createBuffer(size)
      		  }
      		  if (fill !== undefined) {
      		    // Only pay attention to encoding if it's a string. This
      		    // prevents accidentally sending in a number that would
      		    // be interpreted as a start offset.
      		    return typeof encoding === 'string'
      		      ? createBuffer(size).fill(fill, encoding)
      		      : createBuffer(size).fill(fill)
      		  }
      		  return createBuffer(size)
      		}

      		/**
      		 * Creates a new filled Buffer instance.
      		 * alloc(size[, fill[, encoding]])
      		 **/
      		Buffer.alloc = function (size, fill, encoding) {
      		  return alloc(size, fill, encoding)
      		};

      		function allocUnsafe (size) {
      		  assertSize(size);
      		  return createBuffer(size < 0 ? 0 : checked(size) | 0)
      		}

      		/**
      		 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
      		 * */
      		Buffer.allocUnsafe = function (size) {
      		  return allocUnsafe(size)
      		};
      		/**
      		 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
      		 */
      		Buffer.allocUnsafeSlow = function (size) {
      		  return allocUnsafe(size)
      		};

      		function fromString (string, encoding) {
      		  if (typeof encoding !== 'string' || encoding === '') {
      		    encoding = 'utf8';
      		  }

      		  if (!Buffer.isEncoding(encoding)) {
      		    throw new TypeError('Unknown encoding: ' + encoding)
      		  }

      		  const length = byteLength(string, encoding) | 0;
      		  let buf = createBuffer(length);

      		  const actual = buf.write(string, encoding);

      		  if (actual !== length) {
      		    // Writing a hex string, for example, that contains invalid characters will
      		    // cause everything after the first invalid character to be ignored. (e.g.
      		    // 'abxxcd' will be treated as 'ab')
      		    buf = buf.slice(0, actual);
      		  }

      		  return buf
      		}

      		function fromArrayLike (array) {
      		  const length = array.length < 0 ? 0 : checked(array.length) | 0;
      		  const buf = createBuffer(length);
      		  for (let i = 0; i < length; i += 1) {
      		    buf[i] = array[i] & 255;
      		  }
      		  return buf
      		}

      		function fromArrayView (arrayView) {
      		  if (isInstance(arrayView, Uint8Array)) {
      		    const copy = new Uint8Array(arrayView);
      		    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
      		  }
      		  return fromArrayLike(arrayView)
      		}

      		function fromArrayBuffer (array, byteOffset, length) {
      		  if (byteOffset < 0 || array.byteLength < byteOffset) {
      		    throw new RangeError('"offset" is outside of buffer bounds')
      		  }

      		  if (array.byteLength < byteOffset + (length || 0)) {
      		    throw new RangeError('"length" is outside of buffer bounds')
      		  }

      		  let buf;
      		  if (byteOffset === undefined && length === undefined) {
      		    buf = new Uint8Array(array);
      		  } else if (length === undefined) {
      		    buf = new Uint8Array(array, byteOffset);
      		  } else {
      		    buf = new Uint8Array(array, byteOffset, length);
      		  }

      		  // Return an augmented `Uint8Array` instance
      		  Object.setPrototypeOf(buf, Buffer.prototype);

      		  return buf
      		}

      		function fromObject (obj) {
      		  if (Buffer.isBuffer(obj)) {
      		    const len = checked(obj.length) | 0;
      		    const buf = createBuffer(len);

      		    if (buf.length === 0) {
      		      return buf
      		    }

      		    obj.copy(buf, 0, 0, len);
      		    return buf
      		  }

      		  if (obj.length !== undefined) {
      		    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      		      return createBuffer(0)
      		    }
      		    return fromArrayLike(obj)
      		  }

      		  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      		    return fromArrayLike(obj.data)
      		  }
      		}

      		function checked (length) {
      		  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
      		  // length is NaN (which is otherwise coerced to zero.)
      		  if (length >= K_MAX_LENGTH) {
      		    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      		                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
      		  }
      		  return length | 0
      		}

      		function SlowBuffer (length) {
      		  if (+length != length) { // eslint-disable-line eqeqeq
      		    length = 0;
      		  }
      		  return Buffer.alloc(+length)
      		}

      		Buffer.isBuffer = function isBuffer (b) {
      		  return b != null && b._isBuffer === true &&
      		    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
      		};

      		Buffer.compare = function compare (a, b) {
      		  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
      		  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
      		  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
      		    throw new TypeError(
      		      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
      		    )
      		  }

      		  if (a === b) return 0

      		  let x = a.length;
      		  let y = b.length;

      		  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
      		    if (a[i] !== b[i]) {
      		      x = a[i];
      		      y = b[i];
      		      break
      		    }
      		  }

      		  if (x < y) return -1
      		  if (y < x) return 1
      		  return 0
      		};

      		Buffer.isEncoding = function isEncoding (encoding) {
      		  switch (String(encoding).toLowerCase()) {
      		    case 'hex':
      		    case 'utf8':
      		    case 'utf-8':
      		    case 'ascii':
      		    case 'latin1':
      		    case 'binary':
      		    case 'base64':
      		    case 'ucs2':
      		    case 'ucs-2':
      		    case 'utf16le':
      		    case 'utf-16le':
      		      return true
      		    default:
      		      return false
      		  }
      		};

      		Buffer.concat = function concat (list, length) {
      		  if (!Array.isArray(list)) {
      		    throw new TypeError('"list" argument must be an Array of Buffers')
      		  }

      		  if (list.length === 0) {
      		    return Buffer.alloc(0)
      		  }

      		  let i;
      		  if (length === undefined) {
      		    length = 0;
      		    for (i = 0; i < list.length; ++i) {
      		      length += list[i].length;
      		    }
      		  }

      		  const buffer = Buffer.allocUnsafe(length);
      		  let pos = 0;
      		  for (i = 0; i < list.length; ++i) {
      		    let buf = list[i];
      		    if (isInstance(buf, Uint8Array)) {
      		      if (pos + buf.length > buffer.length) {
      		        if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
      		        buf.copy(buffer, pos);
      		      } else {
      		        Uint8Array.prototype.set.call(
      		          buffer,
      		          buf,
      		          pos
      		        );
      		      }
      		    } else if (!Buffer.isBuffer(buf)) {
      		      throw new TypeError('"list" argument must be an Array of Buffers')
      		    } else {
      		      buf.copy(buffer, pos);
      		    }
      		    pos += buf.length;
      		  }
      		  return buffer
      		};

      		function byteLength (string, encoding) {
      		  if (Buffer.isBuffer(string)) {
      		    return string.length
      		  }
      		  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
      		    return string.byteLength
      		  }
      		  if (typeof string !== 'string') {
      		    throw new TypeError(
      		      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      		      'Received type ' + typeof string
      		    )
      		  }

      		  const len = string.length;
      		  const mustMatch = (arguments.length > 2 && arguments[2] === true);
      		  if (!mustMatch && len === 0) return 0

      		  // Use a for loop to avoid recursion
      		  let loweredCase = false;
      		  for (;;) {
      		    switch (encoding) {
      		      case 'ascii':
      		      case 'latin1':
      		      case 'binary':
      		        return len
      		      case 'utf8':
      		      case 'utf-8':
      		        return utf8ToBytes(string).length
      		      case 'ucs2':
      		      case 'ucs-2':
      		      case 'utf16le':
      		      case 'utf-16le':
      		        return len * 2
      		      case 'hex':
      		        return len >>> 1
      		      case 'base64':
      		        return base64ToBytes(string).length
      		      default:
      		        if (loweredCase) {
      		          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
      		        }
      		        encoding = ('' + encoding).toLowerCase();
      		        loweredCase = true;
      		    }
      		  }
      		}
      		Buffer.byteLength = byteLength;

      		function slowToString (encoding, start, end) {
      		  let loweredCase = false;

      		  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
      		  // property of a typed array.

      		  // This behaves neither like String nor Uint8Array in that we set start/end
      		  // to their upper/lower bounds if the value passed is out of range.
      		  // undefined is handled specially as per ECMA-262 6th Edition,
      		  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
      		  if (start === undefined || start < 0) {
      		    start = 0;
      		  }
      		  // Return early if start > this.length. Done here to prevent potential uint32
      		  // coercion fail below.
      		  if (start > this.length) {
      		    return ''
      		  }

      		  if (end === undefined || end > this.length) {
      		    end = this.length;
      		  }

      		  if (end <= 0) {
      		    return ''
      		  }

      		  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
      		  end >>>= 0;
      		  start >>>= 0;

      		  if (end <= start) {
      		    return ''
      		  }

      		  if (!encoding) encoding = 'utf8';

      		  while (true) {
      		    switch (encoding) {
      		      case 'hex':
      		        return hexSlice(this, start, end)

      		      case 'utf8':
      		      case 'utf-8':
      		        return utf8Slice(this, start, end)

      		      case 'ascii':
      		        return asciiSlice(this, start, end)

      		      case 'latin1':
      		      case 'binary':
      		        return latin1Slice(this, start, end)

      		      case 'base64':
      		        return base64Slice(this, start, end)

      		      case 'ucs2':
      		      case 'ucs-2':
      		      case 'utf16le':
      		      case 'utf-16le':
      		        return utf16leSlice(this, start, end)

      		      default:
      		        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
      		        encoding = (encoding + '').toLowerCase();
      		        loweredCase = true;
      		    }
      		  }
      		}

      		// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
      		// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
      		// reliably in a browserify context because there could be multiple different
      		// copies of the 'buffer' package in use. This method works even for Buffer
      		// instances that were created from another copy of the `buffer` package.
      		// See: https://github.com/feross/buffer/issues/154
      		Buffer.prototype._isBuffer = true;

      		function swap (b, n, m) {
      		  const i = b[n];
      		  b[n] = b[m];
      		  b[m] = i;
      		}

      		Buffer.prototype.swap16 = function swap16 () {
      		  const len = this.length;
      		  if (len % 2 !== 0) {
      		    throw new RangeError('Buffer size must be a multiple of 16-bits')
      		  }
      		  for (let i = 0; i < len; i += 2) {
      		    swap(this, i, i + 1);
      		  }
      		  return this
      		};

      		Buffer.prototype.swap32 = function swap32 () {
      		  const len = this.length;
      		  if (len % 4 !== 0) {
      		    throw new RangeError('Buffer size must be a multiple of 32-bits')
      		  }
      		  for (let i = 0; i < len; i += 4) {
      		    swap(this, i, i + 3);
      		    swap(this, i + 1, i + 2);
      		  }
      		  return this
      		};

      		Buffer.prototype.swap64 = function swap64 () {
      		  const len = this.length;
      		  if (len % 8 !== 0) {
      		    throw new RangeError('Buffer size must be a multiple of 64-bits')
      		  }
      		  for (let i = 0; i < len; i += 8) {
      		    swap(this, i, i + 7);
      		    swap(this, i + 1, i + 6);
      		    swap(this, i + 2, i + 5);
      		    swap(this, i + 3, i + 4);
      		  }
      		  return this
      		};

      		Buffer.prototype.toString = function toString () {
      		  const length = this.length;
      		  if (length === 0) return ''
      		  if (arguments.length === 0) return utf8Slice(this, 0, length)
      		  return slowToString.apply(this, arguments)
      		};

      		Buffer.prototype.toLocaleString = Buffer.prototype.toString;

      		Buffer.prototype.equals = function equals (b) {
      		  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
      		  if (this === b) return true
      		  return Buffer.compare(this, b) === 0
      		};

      		Buffer.prototype.inspect = function inspect () {
      		  let str = '';
      		  const max = exports.INSPECT_MAX_BYTES;
      		  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim();
      		  if (this.length > max) str += ' ... ';
      		  return '<Buffer ' + str + '>'
      		};
      		if (customInspectSymbol) {
      		  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
      		}

      		Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
      		  if (isInstance(target, Uint8Array)) {
      		    target = Buffer.from(target, target.offset, target.byteLength);
      		  }
      		  if (!Buffer.isBuffer(target)) {
      		    throw new TypeError(
      		      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      		      'Received type ' + (typeof target)
      		    )
      		  }

      		  if (start === undefined) {
      		    start = 0;
      		  }
      		  if (end === undefined) {
      		    end = target ? target.length : 0;
      		  }
      		  if (thisStart === undefined) {
      		    thisStart = 0;
      		  }
      		  if (thisEnd === undefined) {
      		    thisEnd = this.length;
      		  }

      		  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
      		    throw new RangeError('out of range index')
      		  }

      		  if (thisStart >= thisEnd && start >= end) {
      		    return 0
      		  }
      		  if (thisStart >= thisEnd) {
      		    return -1
      		  }
      		  if (start >= end) {
      		    return 1
      		  }

      		  start >>>= 0;
      		  end >>>= 0;
      		  thisStart >>>= 0;
      		  thisEnd >>>= 0;

      		  if (this === target) return 0

      		  let x = thisEnd - thisStart;
      		  let y = end - start;
      		  const len = Math.min(x, y);

      		  const thisCopy = this.slice(thisStart, thisEnd);
      		  const targetCopy = target.slice(start, end);

      		  for (let i = 0; i < len; ++i) {
      		    if (thisCopy[i] !== targetCopy[i]) {
      		      x = thisCopy[i];
      		      y = targetCopy[i];
      		      break
      		    }
      		  }

      		  if (x < y) return -1
      		  if (y < x) return 1
      		  return 0
      		};

      		// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
      		// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
      		//
      		// Arguments:
      		// - buffer - a Buffer to search
      		// - val - a string, Buffer, or number
      		// - byteOffset - an index into `buffer`; will be clamped to an int32
      		// - encoding - an optional encoding, relevant is val is a string
      		// - dir - true for indexOf, false for lastIndexOf
      		function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
      		  // Empty buffer means no match
      		  if (buffer.length === 0) return -1

      		  // Normalize byteOffset
      		  if (typeof byteOffset === 'string') {
      		    encoding = byteOffset;
      		    byteOffset = 0;
      		  } else if (byteOffset > 0x7fffffff) {
      		    byteOffset = 0x7fffffff;
      		  } else if (byteOffset < -2147483648) {
      		    byteOffset = -2147483648;
      		  }
      		  byteOffset = +byteOffset; // Coerce to Number.
      		  if (numberIsNaN(byteOffset)) {
      		    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      		    byteOffset = dir ? 0 : (buffer.length - 1);
      		  }

      		  // Normalize byteOffset: negative offsets start from the end of the buffer
      		  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
      		  if (byteOffset >= buffer.length) {
      		    if (dir) return -1
      		    else byteOffset = buffer.length - 1;
      		  } else if (byteOffset < 0) {
      		    if (dir) byteOffset = 0;
      		    else return -1
      		  }

      		  // Normalize val
      		  if (typeof val === 'string') {
      		    val = Buffer.from(val, encoding);
      		  }

      		  // Finally, search either indexOf (if dir is true) or lastIndexOf
      		  if (Buffer.isBuffer(val)) {
      		    // Special case: looking for empty string/buffer always fails
      		    if (val.length === 0) {
      		      return -1
      		    }
      		    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
      		  } else if (typeof val === 'number') {
      		    val = val & 0xFF; // Search for a byte value [0-255]
      		    if (typeof Uint8Array.prototype.indexOf === 'function') {
      		      if (dir) {
      		        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      		      } else {
      		        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      		      }
      		    }
      		    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
      		  }

      		  throw new TypeError('val must be string, number or Buffer')
      		}

      		function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
      		  let indexSize = 1;
      		  let arrLength = arr.length;
      		  let valLength = val.length;

      		  if (encoding !== undefined) {
      		    encoding = String(encoding).toLowerCase();
      		    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
      		        encoding === 'utf16le' || encoding === 'utf-16le') {
      		      if (arr.length < 2 || val.length < 2) {
      		        return -1
      		      }
      		      indexSize = 2;
      		      arrLength /= 2;
      		      valLength /= 2;
      		      byteOffset /= 2;
      		    }
      		  }

      		  function read (buf, i) {
      		    if (indexSize === 1) {
      		      return buf[i]
      		    } else {
      		      return buf.readUInt16BE(i * indexSize)
      		    }
      		  }

      		  let i;
      		  if (dir) {
      		    let foundIndex = -1;
      		    for (i = byteOffset; i < arrLength; i++) {
      		      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
      		        if (foundIndex === -1) foundIndex = i;
      		        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      		      } else {
      		        if (foundIndex !== -1) i -= i - foundIndex;
      		        foundIndex = -1;
      		      }
      		    }
      		  } else {
      		    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
      		    for (i = byteOffset; i >= 0; i--) {
      		      let found = true;
      		      for (let j = 0; j < valLength; j++) {
      		        if (read(arr, i + j) !== read(val, j)) {
      		          found = false;
      		          break
      		        }
      		      }
      		      if (found) return i
      		    }
      		  }

      		  return -1
      		}

      		Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
      		  return this.indexOf(val, byteOffset, encoding) !== -1
      		};

      		Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
      		  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
      		};

      		Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
      		  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
      		};

      		function hexWrite (buf, string, offset, length) {
      		  offset = Number(offset) || 0;
      		  const remaining = buf.length - offset;
      		  if (!length) {
      		    length = remaining;
      		  } else {
      		    length = Number(length);
      		    if (length > remaining) {
      		      length = remaining;
      		    }
      		  }

      		  const strLen = string.length;

      		  if (length > strLen / 2) {
      		    length = strLen / 2;
      		  }
      		  let i;
      		  for (i = 0; i < length; ++i) {
      		    const parsed = parseInt(string.substr(i * 2, 2), 16);
      		    if (numberIsNaN(parsed)) return i
      		    buf[offset + i] = parsed;
      		  }
      		  return i
      		}

      		function utf8Write (buf, string, offset, length) {
      		  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
      		}

      		function asciiWrite (buf, string, offset, length) {
      		  return blitBuffer(asciiToBytes(string), buf, offset, length)
      		}

      		function base64Write (buf, string, offset, length) {
      		  return blitBuffer(base64ToBytes(string), buf, offset, length)
      		}

      		function ucs2Write (buf, string, offset, length) {
      		  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
      		}

      		Buffer.prototype.write = function write (string, offset, length, encoding) {
      		  // Buffer#write(string)
      		  if (offset === undefined) {
      		    encoding = 'utf8';
      		    length = this.length;
      		    offset = 0;
      		  // Buffer#write(string, encoding)
      		  } else if (length === undefined && typeof offset === 'string') {
      		    encoding = offset;
      		    length = this.length;
      		    offset = 0;
      		  // Buffer#write(string, offset[, length][, encoding])
      		  } else if (isFinite(offset)) {
      		    offset = offset >>> 0;
      		    if (isFinite(length)) {
      		      length = length >>> 0;
      		      if (encoding === undefined) encoding = 'utf8';
      		    } else {
      		      encoding = length;
      		      length = undefined;
      		    }
      		  } else {
      		    throw new Error(
      		      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
      		    )
      		  }

      		  const remaining = this.length - offset;
      		  if (length === undefined || length > remaining) length = remaining;

      		  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
      		    throw new RangeError('Attempt to write outside buffer bounds')
      		  }

      		  if (!encoding) encoding = 'utf8';

      		  let loweredCase = false;
      		  for (;;) {
      		    switch (encoding) {
      		      case 'hex':
      		        return hexWrite(this, string, offset, length)

      		      case 'utf8':
      		      case 'utf-8':
      		        return utf8Write(this, string, offset, length)

      		      case 'ascii':
      		      case 'latin1':
      		      case 'binary':
      		        return asciiWrite(this, string, offset, length)

      		      case 'base64':
      		        // Warning: maxLength not taken into account in base64Write
      		        return base64Write(this, string, offset, length)

      		      case 'ucs2':
      		      case 'ucs-2':
      		      case 'utf16le':
      		      case 'utf-16le':
      		        return ucs2Write(this, string, offset, length)

      		      default:
      		        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
      		        encoding = ('' + encoding).toLowerCase();
      		        loweredCase = true;
      		    }
      		  }
      		};

      		Buffer.prototype.toJSON = function toJSON () {
      		  return {
      		    type: 'Buffer',
      		    data: Array.prototype.slice.call(this._arr || this, 0)
      		  }
      		};

      		function base64Slice (buf, start, end) {
      		  if (start === 0 && end === buf.length) {
      		    return base64.fromByteArray(buf)
      		  } else {
      		    return base64.fromByteArray(buf.slice(start, end))
      		  }
      		}

      		function utf8Slice (buf, start, end) {
      		  end = Math.min(buf.length, end);
      		  const res = [];

      		  let i = start;
      		  while (i < end) {
      		    const firstByte = buf[i];
      		    let codePoint = null;
      		    let bytesPerSequence = (firstByte > 0xEF)
      		      ? 4
      		      : (firstByte > 0xDF)
      		          ? 3
      		          : (firstByte > 0xBF)
      		              ? 2
      		              : 1;

      		    if (i + bytesPerSequence <= end) {
      		      let secondByte, thirdByte, fourthByte, tempCodePoint;

      		      switch (bytesPerSequence) {
      		        case 1:
      		          if (firstByte < 0x80) {
      		            codePoint = firstByte;
      		          }
      		          break
      		        case 2:
      		          secondByte = buf[i + 1];
      		          if ((secondByte & 0xC0) === 0x80) {
      		            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
      		            if (tempCodePoint > 0x7F) {
      		              codePoint = tempCodePoint;
      		            }
      		          }
      		          break
      		        case 3:
      		          secondByte = buf[i + 1];
      		          thirdByte = buf[i + 2];
      		          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
      		            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
      		            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
      		              codePoint = tempCodePoint;
      		            }
      		          }
      		          break
      		        case 4:
      		          secondByte = buf[i + 1];
      		          thirdByte = buf[i + 2];
      		          fourthByte = buf[i + 3];
      		          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
      		            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
      		            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
      		              codePoint = tempCodePoint;
      		            }
      		          }
      		      }
      		    }

      		    if (codePoint === null) {
      		      // we did not generate a valid codePoint so insert a
      		      // replacement char (U+FFFD) and advance only 1 byte
      		      codePoint = 0xFFFD;
      		      bytesPerSequence = 1;
      		    } else if (codePoint > 0xFFFF) {
      		      // encode to utf16 (surrogate pair dance)
      		      codePoint -= 0x10000;
      		      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      		      codePoint = 0xDC00 | codePoint & 0x3FF;
      		    }

      		    res.push(codePoint);
      		    i += bytesPerSequence;
      		  }

      		  return decodeCodePointsArray(res)
      		}

      		// Based on http://stackoverflow.com/a/22747272/680742, the browser with
      		// the lowest limit is Chrome, with 0x10000 args.
      		// We go 1 magnitude less, for safety
      		const MAX_ARGUMENTS_LENGTH = 0x1000;

      		function decodeCodePointsArray (codePoints) {
      		  const len = codePoints.length;
      		  if (len <= MAX_ARGUMENTS_LENGTH) {
      		    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
      		  }

      		  // Decode in chunks to avoid "call stack size exceeded".
      		  let res = '';
      		  let i = 0;
      		  while (i < len) {
      		    res += String.fromCharCode.apply(
      		      String,
      		      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
      		    );
      		  }
      		  return res
      		}

      		function asciiSlice (buf, start, end) {
      		  let ret = '';
      		  end = Math.min(buf.length, end);

      		  for (let i = start; i < end; ++i) {
      		    ret += String.fromCharCode(buf[i] & 0x7F);
      		  }
      		  return ret
      		}

      		function latin1Slice (buf, start, end) {
      		  let ret = '';
      		  end = Math.min(buf.length, end);

      		  for (let i = start; i < end; ++i) {
      		    ret += String.fromCharCode(buf[i]);
      		  }
      		  return ret
      		}

      		function hexSlice (buf, start, end) {
      		  const len = buf.length;

      		  if (!start || start < 0) start = 0;
      		  if (!end || end < 0 || end > len) end = len;

      		  let out = '';
      		  for (let i = start; i < end; ++i) {
      		    out += hexSliceLookupTable[buf[i]];
      		  }
      		  return out
      		}

      		function utf16leSlice (buf, start, end) {
      		  const bytes = buf.slice(start, end);
      		  let res = '';
      		  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
      		  for (let i = 0; i < bytes.length - 1; i += 2) {
      		    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256));
      		  }
      		  return res
      		}

      		Buffer.prototype.slice = function slice (start, end) {
      		  const len = this.length;
      		  start = ~~start;
      		  end = end === undefined ? len : ~~end;

      		  if (start < 0) {
      		    start += len;
      		    if (start < 0) start = 0;
      		  } else if (start > len) {
      		    start = len;
      		  }

      		  if (end < 0) {
      		    end += len;
      		    if (end < 0) end = 0;
      		  } else if (end > len) {
      		    end = len;
      		  }

      		  if (end < start) end = start;

      		  const newBuf = this.subarray(start, end);
      		  // Return an augmented `Uint8Array` instance
      		  Object.setPrototypeOf(newBuf, Buffer.prototype);

      		  return newBuf
      		};

      		/*
      		 * Need to make sure that buffer isn't trying to write out of bounds.
      		 */
      		function checkOffset (offset, ext, length) {
      		  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
      		  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
      		}

      		Buffer.prototype.readUintLE =
      		Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
      		  offset = offset >>> 0;
      		  byteLength = byteLength >>> 0;
      		  if (!noAssert) checkOffset(offset, byteLength, this.length);

      		  let val = this[offset];
      		  let mul = 1;
      		  let i = 0;
      		  while (++i < byteLength && (mul *= 0x100)) {
      		    val += this[offset + i] * mul;
      		  }

      		  return val
      		};

      		Buffer.prototype.readUintBE =
      		Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
      		  offset = offset >>> 0;
      		  byteLength = byteLength >>> 0;
      		  if (!noAssert) {
      		    checkOffset(offset, byteLength, this.length);
      		  }

      		  let val = this[offset + --byteLength];
      		  let mul = 1;
      		  while (byteLength > 0 && (mul *= 0x100)) {
      		    val += this[offset + --byteLength] * mul;
      		  }

      		  return val
      		};

      		Buffer.prototype.readUint8 =
      		Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 1, this.length);
      		  return this[offset]
      		};

      		Buffer.prototype.readUint16LE =
      		Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 2, this.length);
      		  return this[offset] | (this[offset + 1] << 8)
      		};

      		Buffer.prototype.readUint16BE =
      		Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 2, this.length);
      		  return (this[offset] << 8) | this[offset + 1]
      		};

      		Buffer.prototype.readUint32LE =
      		Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 4, this.length);

      		  return ((this[offset]) |
      		      (this[offset + 1] << 8) |
      		      (this[offset + 2] << 16)) +
      		      (this[offset + 3] * 0x1000000)
      		};

      		Buffer.prototype.readUint32BE =
      		Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 4, this.length);

      		  return (this[offset] * 0x1000000) +
      		    ((this[offset + 1] << 16) |
      		    (this[offset + 2] << 8) |
      		    this[offset + 3])
      		};

      		Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE (offset) {
      		  offset = offset >>> 0;
      		  validateNumber(offset, 'offset');
      		  const first = this[offset];
      		  const last = this[offset + 7];
      		  if (first === undefined || last === undefined) {
      		    boundsError(offset, this.length - 8);
      		  }

      		  const lo = first +
      		    this[++offset] * 2 ** 8 +
      		    this[++offset] * 2 ** 16 +
      		    this[++offset] * 2 ** 24;

      		  const hi = this[++offset] +
      		    this[++offset] * 2 ** 8 +
      		    this[++offset] * 2 ** 16 +
      		    last * 2 ** 24;

      		  return BigInt(lo) + (BigInt(hi) << BigInt(32))
      		});

      		Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE (offset) {
      		  offset = offset >>> 0;
      		  validateNumber(offset, 'offset');
      		  const first = this[offset];
      		  const last = this[offset + 7];
      		  if (first === undefined || last === undefined) {
      		    boundsError(offset, this.length - 8);
      		  }

      		  const hi = first * 2 ** 24 +
      		    this[++offset] * 2 ** 16 +
      		    this[++offset] * 2 ** 8 +
      		    this[++offset];

      		  const lo = this[++offset] * 2 ** 24 +
      		    this[++offset] * 2 ** 16 +
      		    this[++offset] * 2 ** 8 +
      		    last;

      		  return (BigInt(hi) << BigInt(32)) + BigInt(lo)
      		});

      		Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
      		  offset = offset >>> 0;
      		  byteLength = byteLength >>> 0;
      		  if (!noAssert) checkOffset(offset, byteLength, this.length);

      		  let val = this[offset];
      		  let mul = 1;
      		  let i = 0;
      		  while (++i < byteLength && (mul *= 0x100)) {
      		    val += this[offset + i] * mul;
      		  }
      		  mul *= 0x80;

      		  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

      		  return val
      		};

      		Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
      		  offset = offset >>> 0;
      		  byteLength = byteLength >>> 0;
      		  if (!noAssert) checkOffset(offset, byteLength, this.length);

      		  let i = byteLength;
      		  let mul = 1;
      		  let val = this[offset + --i];
      		  while (i > 0 && (mul *= 0x100)) {
      		    val += this[offset + --i] * mul;
      		  }
      		  mul *= 0x80;

      		  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

      		  return val
      		};

      		Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 1, this.length);
      		  if (!(this[offset] & 0x80)) return (this[offset])
      		  return ((0xff - this[offset] + 1) * -1)
      		};

      		Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 2, this.length);
      		  const val = this[offset] | (this[offset + 1] << 8);
      		  return (val & 0x8000) ? val | 0xFFFF0000 : val
      		};

      		Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 2, this.length);
      		  const val = this[offset + 1] | (this[offset] << 8);
      		  return (val & 0x8000) ? val | 0xFFFF0000 : val
      		};

      		Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 4, this.length);

      		  return (this[offset]) |
      		    (this[offset + 1] << 8) |
      		    (this[offset + 2] << 16) |
      		    (this[offset + 3] << 24)
      		};

      		Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 4, this.length);

      		  return (this[offset] << 24) |
      		    (this[offset + 1] << 16) |
      		    (this[offset + 2] << 8) |
      		    (this[offset + 3])
      		};

      		Buffer.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE (offset) {
      		  offset = offset >>> 0;
      		  validateNumber(offset, 'offset');
      		  const first = this[offset];
      		  const last = this[offset + 7];
      		  if (first === undefined || last === undefined) {
      		    boundsError(offset, this.length - 8);
      		  }

      		  const val = this[offset + 4] +
      		    this[offset + 5] * 2 ** 8 +
      		    this[offset + 6] * 2 ** 16 +
      		    (last << 24); // Overflow

      		  return (BigInt(val) << BigInt(32)) +
      		    BigInt(first +
      		    this[++offset] * 2 ** 8 +
      		    this[++offset] * 2 ** 16 +
      		    this[++offset] * 2 ** 24)
      		});

      		Buffer.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE (offset) {
      		  offset = offset >>> 0;
      		  validateNumber(offset, 'offset');
      		  const first = this[offset];
      		  const last = this[offset + 7];
      		  if (first === undefined || last === undefined) {
      		    boundsError(offset, this.length - 8);
      		  }

      		  const val = (first << 24) + // Overflow
      		    this[++offset] * 2 ** 16 +
      		    this[++offset] * 2 ** 8 +
      		    this[++offset];

      		  return (BigInt(val) << BigInt(32)) +
      		    BigInt(this[++offset] * 2 ** 24 +
      		    this[++offset] * 2 ** 16 +
      		    this[++offset] * 2 ** 8 +
      		    last)
      		});

      		Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 4, this.length);
      		  return ieee754.read(this, offset, true, 23, 4)
      		};

      		Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 4, this.length);
      		  return ieee754.read(this, offset, false, 23, 4)
      		};

      		Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 8, this.length);
      		  return ieee754.read(this, offset, true, 52, 8)
      		};

      		Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
      		  offset = offset >>> 0;
      		  if (!noAssert) checkOffset(offset, 8, this.length);
      		  return ieee754.read(this, offset, false, 52, 8)
      		};

      		function checkInt (buf, value, offset, ext, max, min) {
      		  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
      		  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
      		  if (offset + ext > buf.length) throw new RangeError('Index out of range')
      		}

      		Buffer.prototype.writeUintLE =
      		Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  byteLength = byteLength >>> 0;
      		  if (!noAssert) {
      		    const maxBytes = Math.pow(2, 8 * byteLength) - 1;
      		    checkInt(this, value, offset, byteLength, maxBytes, 0);
      		  }

      		  let mul = 1;
      		  let i = 0;
      		  this[offset] = value & 0xFF;
      		  while (++i < byteLength && (mul *= 0x100)) {
      		    this[offset + i] = (value / mul) & 0xFF;
      		  }

      		  return offset + byteLength
      		};

      		Buffer.prototype.writeUintBE =
      		Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  byteLength = byteLength >>> 0;
      		  if (!noAssert) {
      		    const maxBytes = Math.pow(2, 8 * byteLength) - 1;
      		    checkInt(this, value, offset, byteLength, maxBytes, 0);
      		  }

      		  let i = byteLength - 1;
      		  let mul = 1;
      		  this[offset + i] = value & 0xFF;
      		  while (--i >= 0 && (mul *= 0x100)) {
      		    this[offset + i] = (value / mul) & 0xFF;
      		  }

      		  return offset + byteLength
      		};

      		Buffer.prototype.writeUint8 =
      		Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
      		  this[offset] = (value & 0xff);
      		  return offset + 1
      		};

      		Buffer.prototype.writeUint16LE =
      		Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
      		  this[offset] = (value & 0xff);
      		  this[offset + 1] = (value >>> 8);
      		  return offset + 2
      		};

      		Buffer.prototype.writeUint16BE =
      		Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
      		  this[offset] = (value >>> 8);
      		  this[offset + 1] = (value & 0xff);
      		  return offset + 2
      		};

      		Buffer.prototype.writeUint32LE =
      		Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
      		  this[offset + 3] = (value >>> 24);
      		  this[offset + 2] = (value >>> 16);
      		  this[offset + 1] = (value >>> 8);
      		  this[offset] = (value & 0xff);
      		  return offset + 4
      		};

      		Buffer.prototype.writeUint32BE =
      		Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
      		  this[offset] = (value >>> 24);
      		  this[offset + 1] = (value >>> 16);
      		  this[offset + 2] = (value >>> 8);
      		  this[offset + 3] = (value & 0xff);
      		  return offset + 4
      		};

      		function wrtBigUInt64LE (buf, value, offset, min, max) {
      		  checkIntBI(value, min, max, buf, offset, 7);

      		  let lo = Number(value & BigInt(0xffffffff));
      		  buf[offset++] = lo;
      		  lo = lo >> 8;
      		  buf[offset++] = lo;
      		  lo = lo >> 8;
      		  buf[offset++] = lo;
      		  lo = lo >> 8;
      		  buf[offset++] = lo;
      		  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff));
      		  buf[offset++] = hi;
      		  hi = hi >> 8;
      		  buf[offset++] = hi;
      		  hi = hi >> 8;
      		  buf[offset++] = hi;
      		  hi = hi >> 8;
      		  buf[offset++] = hi;
      		  return offset
      		}

      		function wrtBigUInt64BE (buf, value, offset, min, max) {
      		  checkIntBI(value, min, max, buf, offset, 7);

      		  let lo = Number(value & BigInt(0xffffffff));
      		  buf[offset + 7] = lo;
      		  lo = lo >> 8;
      		  buf[offset + 6] = lo;
      		  lo = lo >> 8;
      		  buf[offset + 5] = lo;
      		  lo = lo >> 8;
      		  buf[offset + 4] = lo;
      		  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff));
      		  buf[offset + 3] = hi;
      		  hi = hi >> 8;
      		  buf[offset + 2] = hi;
      		  hi = hi >> 8;
      		  buf[offset + 1] = hi;
      		  hi = hi >> 8;
      		  buf[offset] = hi;
      		  return offset + 8
      		}

      		Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE (value, offset = 0) {
      		  return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
      		});

      		Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE (value, offset = 0) {
      		  return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
      		});

      		Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) {
      		    const limit = Math.pow(2, (8 * byteLength) - 1);

      		    checkInt(this, value, offset, byteLength, limit - 1, -limit);
      		  }

      		  let i = 0;
      		  let mul = 1;
      		  let sub = 0;
      		  this[offset] = value & 0xFF;
      		  while (++i < byteLength && (mul *= 0x100)) {
      		    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      		      sub = 1;
      		    }
      		    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
      		  }

      		  return offset + byteLength
      		};

      		Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) {
      		    const limit = Math.pow(2, (8 * byteLength) - 1);

      		    checkInt(this, value, offset, byteLength, limit - 1, -limit);
      		  }

      		  let i = byteLength - 1;
      		  let mul = 1;
      		  let sub = 0;
      		  this[offset + i] = value & 0xFF;
      		  while (--i >= 0 && (mul *= 0x100)) {
      		    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      		      sub = 1;
      		    }
      		    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
      		  }

      		  return offset + byteLength
      		};

      		Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -128);
      		  if (value < 0) value = 0xff + value + 1;
      		  this[offset] = (value & 0xff);
      		  return offset + 1
      		};

      		Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -32768);
      		  this[offset] = (value & 0xff);
      		  this[offset + 1] = (value >>> 8);
      		  return offset + 2
      		};

      		Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -32768);
      		  this[offset] = (value >>> 8);
      		  this[offset + 1] = (value & 0xff);
      		  return offset + 2
      		};

      		Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -2147483648);
      		  this[offset] = (value & 0xff);
      		  this[offset + 1] = (value >>> 8);
      		  this[offset + 2] = (value >>> 16);
      		  this[offset + 3] = (value >>> 24);
      		  return offset + 4
      		};

      		Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -2147483648);
      		  if (value < 0) value = 0xffffffff + value + 1;
      		  this[offset] = (value >>> 24);
      		  this[offset + 1] = (value >>> 16);
      		  this[offset + 2] = (value >>> 8);
      		  this[offset + 3] = (value & 0xff);
      		  return offset + 4
      		};

      		Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE (value, offset = 0) {
      		  return wrtBigUInt64LE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
      		});

      		Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE (value, offset = 0) {
      		  return wrtBigUInt64BE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
      		});

      		function checkIEEE754 (buf, value, offset, ext, max, min) {
      		  if (offset + ext > buf.length) throw new RangeError('Index out of range')
      		  if (offset < 0) throw new RangeError('Index out of range')
      		}

      		function writeFloat (buf, value, offset, littleEndian, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) {
      		    checkIEEE754(buf, value, offset, 4);
      		  }
      		  ieee754.write(buf, value, offset, littleEndian, 23, 4);
      		  return offset + 4
      		}

      		Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
      		  return writeFloat(this, value, offset, true, noAssert)
      		};

      		Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
      		  return writeFloat(this, value, offset, false, noAssert)
      		};

      		function writeDouble (buf, value, offset, littleEndian, noAssert) {
      		  value = +value;
      		  offset = offset >>> 0;
      		  if (!noAssert) {
      		    checkIEEE754(buf, value, offset, 8);
      		  }
      		  ieee754.write(buf, value, offset, littleEndian, 52, 8);
      		  return offset + 8
      		}

      		Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
      		  return writeDouble(this, value, offset, true, noAssert)
      		};

      		Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
      		  return writeDouble(this, value, offset, false, noAssert)
      		};

      		// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
      		Buffer.prototype.copy = function copy (target, targetStart, start, end) {
      		  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
      		  if (!start) start = 0;
      		  if (!end && end !== 0) end = this.length;
      		  if (targetStart >= target.length) targetStart = target.length;
      		  if (!targetStart) targetStart = 0;
      		  if (end > 0 && end < start) end = start;

      		  // Copy 0 bytes; we're done
      		  if (end === start) return 0
      		  if (target.length === 0 || this.length === 0) return 0

      		  // Fatal error conditions
      		  if (targetStart < 0) {
      		    throw new RangeError('targetStart out of bounds')
      		  }
      		  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
      		  if (end < 0) throw new RangeError('sourceEnd out of bounds')

      		  // Are we oob?
      		  if (end > this.length) end = this.length;
      		  if (target.length - targetStart < end - start) {
      		    end = target.length - targetStart + start;
      		  }

      		  const len = end - start;

      		  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
      		    // Use built-in when available, missing from IE11
      		    this.copyWithin(targetStart, start, end);
      		  } else {
      		    Uint8Array.prototype.set.call(
      		      target,
      		      this.subarray(start, end),
      		      targetStart
      		    );
      		  }

      		  return len
      		};

      		// Usage:
      		//    buffer.fill(number[, offset[, end]])
      		//    buffer.fill(buffer[, offset[, end]])
      		//    buffer.fill(string[, offset[, end]][, encoding])
      		Buffer.prototype.fill = function fill (val, start, end, encoding) {
      		  // Handle string cases:
      		  if (typeof val === 'string') {
      		    if (typeof start === 'string') {
      		      encoding = start;
      		      start = 0;
      		      end = this.length;
      		    } else if (typeof end === 'string') {
      		      encoding = end;
      		      end = this.length;
      		    }
      		    if (encoding !== undefined && typeof encoding !== 'string') {
      		      throw new TypeError('encoding must be a string')
      		    }
      		    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      		      throw new TypeError('Unknown encoding: ' + encoding)
      		    }
      		    if (val.length === 1) {
      		      const code = val.charCodeAt(0);
      		      if ((encoding === 'utf8' && code < 128) ||
      		          encoding === 'latin1') {
      		        // Fast path: If `val` fits into a single byte, use that numeric value.
      		        val = code;
      		      }
      		    }
      		  } else if (typeof val === 'number') {
      		    val = val & 255;
      		  } else if (typeof val === 'boolean') {
      		    val = Number(val);
      		  }

      		  // Invalid ranges are not set to a default, so can range check early.
      		  if (start < 0 || this.length < start || this.length < end) {
      		    throw new RangeError('Out of range index')
      		  }

      		  if (end <= start) {
      		    return this
      		  }

      		  start = start >>> 0;
      		  end = end === undefined ? this.length : end >>> 0;

      		  if (!val) val = 0;

      		  let i;
      		  if (typeof val === 'number') {
      		    for (i = start; i < end; ++i) {
      		      this[i] = val;
      		    }
      		  } else {
      		    const bytes = Buffer.isBuffer(val)
      		      ? val
      		      : Buffer.from(val, encoding);
      		    const len = bytes.length;
      		    if (len === 0) {
      		      throw new TypeError('The value "' + val +
      		        '" is invalid for argument "value"')
      		    }
      		    for (i = 0; i < end - start; ++i) {
      		      this[i + start] = bytes[i % len];
      		    }
      		  }

      		  return this
      		};

      		// CUSTOM ERRORS
      		// =============

      		// Simplified versions from Node, changed for Buffer-only usage
      		const errors = {};
      		function E (sym, getMessage, Base) {
      		  errors[sym] = class NodeError extends Base {
      		    constructor () {
      		      super();

      		      Object.defineProperty(this, 'message', {
      		        value: getMessage.apply(this, arguments),
      		        writable: true,
      		        configurable: true
      		      });

      		      // Add the error code to the name to include it in the stack trace.
      		      this.name = `${this.name} [${sym}]`;
      		      // Access the stack to generate the error message including the error code
      		      // from the name.
      		      this.stack; // eslint-disable-line no-unused-expressions
      		      // Reset the name to the actual name.
      		      delete this.name;
      		    }

      		    get code () {
      		      return sym
      		    }

      		    set code (value) {
      		      Object.defineProperty(this, 'code', {
      		        configurable: true,
      		        enumerable: true,
      		        value,
      		        writable: true
      		      });
      		    }

      		    toString () {
      		      return `${this.name} [${sym}]: ${this.message}`
      		    }
      		  };
      		}

      		E('ERR_BUFFER_OUT_OF_BOUNDS',
      		  function (name) {
      		    if (name) {
      		      return `${name} is outside of buffer bounds`
      		    }

      		    return 'Attempt to access memory outside buffer bounds'
      		  }, RangeError);
      		E('ERR_INVALID_ARG_TYPE',
      		  function (name, actual) {
      		    return `The "${name}" argument must be of type number. Received type ${typeof actual}`
      		  }, TypeError);
      		E('ERR_OUT_OF_RANGE',
      		  function (str, range, input) {
      		    let msg = `The value of "${str}" is out of range.`;
      		    let received = input;
      		    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
      		      received = addNumericalSeparator(String(input));
      		    } else if (typeof input === 'bigint') {
      		      received = String(input);
      		      if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
      		        received = addNumericalSeparator(received);
      		      }
      		      received += 'n';
      		    }
      		    msg += ` It must be ${range}. Received ${received}`;
      		    return msg
      		  }, RangeError);

      		function addNumericalSeparator (val) {
      		  let res = '';
      		  let i = val.length;
      		  const start = val[0] === '-' ? 1 : 0;
      		  for (; i >= start + 4; i -= 3) {
      		    res = `_${val.slice(i - 3, i)}${res}`;
      		  }
      		  return `${val.slice(0, i)}${res}`
      		}

      		// CHECK FUNCTIONS
      		// ===============

      		function checkBounds (buf, offset, byteLength) {
      		  validateNumber(offset, 'offset');
      		  if (buf[offset] === undefined || buf[offset + byteLength] === undefined) {
      		    boundsError(offset, buf.length - (byteLength + 1));
      		  }
      		}

      		function checkIntBI (value, min, max, buf, offset, byteLength) {
      		  if (value > max || value < min) {
      		    const n = typeof min === 'bigint' ? 'n' : '';
      		    let range;
      		    {
      		      if (min === 0 || min === BigInt(0)) {
      		        range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`;
      		      } else {
      		        range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
      		                `${(byteLength + 1) * 8 - 1}${n}`;
      		      }
      		    }
      		    throw new errors.ERR_OUT_OF_RANGE('value', range, value)
      		  }
      		  checkBounds(buf, offset, byteLength);
      		}

      		function validateNumber (value, name) {
      		  if (typeof value !== 'number') {
      		    throw new errors.ERR_INVALID_ARG_TYPE(name, 'number', value)
      		  }
      		}

      		function boundsError (value, length, type) {
      		  if (Math.floor(value) !== value) {
      		    validateNumber(value, type);
      		    throw new errors.ERR_OUT_OF_RANGE('offset', 'an integer', value)
      		  }

      		  if (length < 0) {
      		    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS()
      		  }

      		  throw new errors.ERR_OUT_OF_RANGE('offset',
      		                                    `>= ${0} and <= ${length}`,
      		                                    value)
      		}

      		// HELPER FUNCTIONS
      		// ================

      		const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

      		function base64clean (str) {
      		  // Node takes equal signs as end of the Base64 encoding
      		  str = str.split('=')[0];
      		  // Node strips out invalid characters like \n and \t from the string, base64-js does not
      		  str = str.trim().replace(INVALID_BASE64_RE, '');
      		  // Node converts strings with length < 2 to ''
      		  if (str.length < 2) return ''
      		  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
      		  while (str.length % 4 !== 0) {
      		    str = str + '=';
      		  }
      		  return str
      		}

      		function utf8ToBytes (string, units) {
      		  units = units || Infinity;
      		  let codePoint;
      		  const length = string.length;
      		  let leadSurrogate = null;
      		  const bytes = [];

      		  for (let i = 0; i < length; ++i) {
      		    codePoint = string.charCodeAt(i);

      		    // is surrogate component
      		    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      		      // last char was a lead
      		      if (!leadSurrogate) {
      		        // no lead yet
      		        if (codePoint > 0xDBFF) {
      		          // unexpected trail
      		          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
      		          continue
      		        } else if (i + 1 === length) {
      		          // unpaired lead
      		          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
      		          continue
      		        }

      		        // valid lead
      		        leadSurrogate = codePoint;

      		        continue
      		      }

      		      // 2 leads in a row
      		      if (codePoint < 0xDC00) {
      		        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
      		        leadSurrogate = codePoint;
      		        continue
      		      }

      		      // valid surrogate pair
      		      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
      		    } else if (leadSurrogate) {
      		      // valid bmp char, but last char was a lead
      		      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
      		    }

      		    leadSurrogate = null;

      		    // encode utf8
      		    if (codePoint < 0x80) {
      		      if ((units -= 1) < 0) break
      		      bytes.push(codePoint);
      		    } else if (codePoint < 0x800) {
      		      if ((units -= 2) < 0) break
      		      bytes.push(
      		        codePoint >> 0x6 | 0xC0,
      		        codePoint & 0x3F | 0x80
      		      );
      		    } else if (codePoint < 0x10000) {
      		      if ((units -= 3) < 0) break
      		      bytes.push(
      		        codePoint >> 0xC | 0xE0,
      		        codePoint >> 0x6 & 0x3F | 0x80,
      		        codePoint & 0x3F | 0x80
      		      );
      		    } else if (codePoint < 0x110000) {
      		      if ((units -= 4) < 0) break
      		      bytes.push(
      		        codePoint >> 0x12 | 0xF0,
      		        codePoint >> 0xC & 0x3F | 0x80,
      		        codePoint >> 0x6 & 0x3F | 0x80,
      		        codePoint & 0x3F | 0x80
      		      );
      		    } else {
      		      throw new Error('Invalid code point')
      		    }
      		  }

      		  return bytes
      		}

      		function asciiToBytes (str) {
      		  const byteArray = [];
      		  for (let i = 0; i < str.length; ++i) {
      		    // Node's code seems to be doing this and not & 0x7F..
      		    byteArray.push(str.charCodeAt(i) & 0xFF);
      		  }
      		  return byteArray
      		}

      		function utf16leToBytes (str, units) {
      		  let c, hi, lo;
      		  const byteArray = [];
      		  for (let i = 0; i < str.length; ++i) {
      		    if ((units -= 2) < 0) break

      		    c = str.charCodeAt(i);
      		    hi = c >> 8;
      		    lo = c % 256;
      		    byteArray.push(lo);
      		    byteArray.push(hi);
      		  }

      		  return byteArray
      		}

      		function base64ToBytes (str) {
      		  return base64.toByteArray(base64clean(str))
      		}

      		function blitBuffer (src, dst, offset, length) {
      		  let i;
      		  for (i = 0; i < length; ++i) {
      		    if ((i + offset >= dst.length) || (i >= src.length)) break
      		    dst[i + offset] = src[i];
      		  }
      		  return i
      		}

      		// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
      		// the `instanceof` check but they should be treated as of that type.
      		// See: https://github.com/feross/buffer/issues/166
      		function isInstance (obj, type) {
      		  return obj instanceof type ||
      		    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      		      obj.constructor.name === type.name)
      		}
      		function numberIsNaN (obj) {
      		  // For IE11 support
      		  return obj !== obj // eslint-disable-line no-self-compare
      		}

      		// Create lookup table for `toString('hex')`
      		// See: https://github.com/feross/buffer/issues/219
      		const hexSliceLookupTable = (function () {
      		  const alphabet = '0123456789abcdef';
      		  const table = new Array(256);
      		  for (let i = 0; i < 16; ++i) {
      		    const i16 = i * 16;
      		    for (let j = 0; j < 16; ++j) {
      		      table[i16 + j] = alphabet[i] + alphabet[j];
      		    }
      		  }
      		  return table
      		})();

      		// Return not function with Error if BigInt not supported
      		function defineBigIntMethod (fn) {
      		  return typeof BigInt === 'undefined' ? BufferBigIntNotDefined : fn
      		}

      		function BufferBigIntNotDefined () {
      		  throw new Error('BigInt not supported')
      		} 
      	} (buffer));
      	return buffer;
      }

      var bufferExports = requireBuffer();

      const PACKAGE_VERSION = "1.42.0";
      const TARGETED_RPC_VERSION = "1.59.0";

      const CODE_TO_ERROR_TYPE = {
        "-32700": "ParseError",
        "-32701": "OversizedRequest",
        "-32702": "OversizedResponse",
        "-32600": "InvalidRequest",
        "-32601": "MethodNotFound",
        "-32602": "InvalidParams",
        "-32603": "InternalError",
        "-32604": "ServerBusy",
        "-32000": "CallExecutionFailed",
        "-32001": "UnknownError",
        "-32003": "SubscriptionClosed",
        "-32004": "SubscriptionClosedWithError",
        "-32005": "BatchesNotSupported",
        "-32006": "TooManySubscriptions",
        "-32050": "TransientError",
        "-32002": "TransactionExecutionClientError"
      };
      class SuiHTTPTransportError extends Error {
      } exports("SuiHTTPTransportError", SuiHTTPTransportError);
      class JsonRpcError extends SuiHTTPTransportError {
        constructor(message, code) {
          super(message);
          this.code = code;
          this.type = CODE_TO_ERROR_TYPE[code] ?? "ServerError";
        }
      } exports("JsonRpcError", JsonRpcError);
      class SuiHTTPStatusError extends SuiHTTPTransportError {
        constructor(message, status, statusText) {
          super(message);
          this.status = status;
          this.statusText = statusText;
        }
      } exports("SuiHTTPStatusError", SuiHTTPStatusError);

      var __typeError$b = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$b = (obj, member, msg) => member.has(obj) || __typeError$b("Cannot " + msg);
      var __privateGet$b = (obj, member, getter) => (__accessCheck$b(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$b = (obj, member, value) => member.has(obj) ? __typeError$b("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$a = (obj, member, value, setter) => (__accessCheck$b(obj, member, "write to private field"), member.set(obj, value), value);
      var __privateMethod$4 = (obj, member, method) => (__accessCheck$b(obj, member, "access private method"), method);
      var __privateWrapper$1 = (obj, member, setter, getter) => ({
        set _(value) {
          __privateSet$a(obj, member, value);
        },
        get _() {
          return __privateGet$b(obj, member, getter);
        }
      });
      var _requestId$1, _disconnects, _webSocket, _connectionPromise, _subscriptions, _pendingRequests, _WebsocketClient_instances, setupWebSocket_fn, reconnect_fn;
      function getWebsocketUrl(httpUrl) {
        const url = new URL(httpUrl);
        url.protocol = url.protocol.replace("http", "ws");
        return url.toString();
      }
      const DEFAULT_CLIENT_OPTIONS = {
        // We fudge the typing because we also check for undefined in the constructor:
        WebSocketConstructor: typeof WebSocket !== "undefined" ? WebSocket : void 0,
        callTimeout: 3e4,
        reconnectTimeout: 3e3,
        maxReconnects: 5
      };
      class WebsocketClient {
        constructor(endpoint, options = {}) {
          __privateAdd$b(this, _WebsocketClient_instances);
          __privateAdd$b(this, _requestId$1, 0);
          __privateAdd$b(this, _disconnects, 0);
          __privateAdd$b(this, _webSocket, null);
          __privateAdd$b(this, _connectionPromise, null);
          __privateAdd$b(this, _subscriptions, /* @__PURE__ */ new Set());
          __privateAdd$b(this, _pendingRequests, /* @__PURE__ */ new Map());
          this.endpoint = endpoint;
          this.options = { ...DEFAULT_CLIENT_OPTIONS, ...options };
          if (!this.options.WebSocketConstructor) {
            throw new Error("Missing WebSocket constructor");
          }
          if (this.endpoint.startsWith("http")) {
            this.endpoint = getWebsocketUrl(this.endpoint);
          }
        }
        async makeRequest(method, params, signal) {
          const webSocket = await __privateMethod$4(this, _WebsocketClient_instances, setupWebSocket_fn).call(this);
          return new Promise((resolve, reject) => {
            __privateSet$a(this, _requestId$1, __privateGet$b(this, _requestId$1) + 1);
            __privateGet$b(this, _pendingRequests).set(__privateGet$b(this, _requestId$1), {
              resolve,
              reject,
              timeout: setTimeout(() => {
                __privateGet$b(this, _pendingRequests).delete(__privateGet$b(this, _requestId$1));
                reject(new Error(`Request timeout: ${method}`));
              }, this.options.callTimeout)
            });
            signal?.addEventListener("abort", () => {
              __privateGet$b(this, _pendingRequests).delete(__privateGet$b(this, _requestId$1));
              reject(signal.reason);
            });
            webSocket.send(JSON.stringify({ jsonrpc: "2.0", id: __privateGet$b(this, _requestId$1), method, params }));
          }).then(({ error, result }) => {
            if (error) {
              throw new JsonRpcError(error.message, error.code);
            }
            return result;
          });
        }
        async subscribe(input) {
          const subscription = new RpcSubscription(input);
          __privateGet$b(this, _subscriptions).add(subscription);
          await subscription.subscribe(this);
          return () => subscription.unsubscribe(this);
        }
      }
      _requestId$1 = new WeakMap();
      _disconnects = new WeakMap();
      _webSocket = new WeakMap();
      _connectionPromise = new WeakMap();
      _subscriptions = new WeakMap();
      _pendingRequests = new WeakMap();
      _WebsocketClient_instances = new WeakSet();
      setupWebSocket_fn = function() {
        if (__privateGet$b(this, _connectionPromise)) {
          return __privateGet$b(this, _connectionPromise);
        }
        __privateSet$a(this, _connectionPromise, new Promise((resolve) => {
          __privateGet$b(this, _webSocket)?.close();
          __privateSet$a(this, _webSocket, new this.options.WebSocketConstructor(this.endpoint));
          __privateGet$b(this, _webSocket).addEventListener("open", () => {
            __privateSet$a(this, _disconnects, 0);
            resolve(__privateGet$b(this, _webSocket));
          });
          __privateGet$b(this, _webSocket).addEventListener("close", () => {
            __privateWrapper$1(this, _disconnects)._++;
            if (__privateGet$b(this, _disconnects) <= this.options.maxReconnects) {
              setTimeout(() => {
                __privateMethod$4(this, _WebsocketClient_instances, reconnect_fn).call(this);
              }, this.options.reconnectTimeout);
            }
          });
          __privateGet$b(this, _webSocket).addEventListener("message", ({ data }) => {
            let json;
            try {
              json = JSON.parse(data);
            } catch (error) {
              console.error(new Error(`Failed to parse RPC message: ${data}`, { cause: error }));
              return;
            }
            if ("id" in json && json.id != null && __privateGet$b(this, _pendingRequests).has(json.id)) {
              const { resolve: resolve2, timeout } = __privateGet$b(this, _pendingRequests).get(json.id);
              clearTimeout(timeout);
              resolve2(json);
            } else if ("params" in json) {
              const { params } = json;
              __privateGet$b(this, _subscriptions).forEach((subscription) => {
                if (subscription.subscriptionId === params.subscription) {
                  if (params.subscription === subscription.subscriptionId) {
                    subscription.onMessage(params.result);
                  }
                }
              });
            }
          });
        }));
        return __privateGet$b(this, _connectionPromise);
      };
      reconnect_fn = async function() {
        __privateGet$b(this, _webSocket)?.close();
        __privateSet$a(this, _connectionPromise, null);
        return Promise.allSettled(
          [...__privateGet$b(this, _subscriptions)].map((subscription) => subscription.subscribe(this))
        );
      };
      class RpcSubscription {
        constructor(input) {
          this.subscriptionId = null;
          this.subscribed = false;
          this.input = input;
        }
        onMessage(message) {
          if (this.subscribed) {
            this.input.onMessage(message);
          }
        }
        async unsubscribe(client) {
          const { subscriptionId } = this;
          this.subscribed = false;
          if (subscriptionId == null) return false;
          this.subscriptionId = null;
          return client.makeRequest(this.input.unsubscribe, [subscriptionId]);
        }
        async subscribe(client) {
          this.subscriptionId = null;
          this.subscribed = true;
          const newSubscriptionId = await client.makeRequest(
            this.input.method,
            this.input.params,
            this.input.signal
          );
          if (this.subscribed) {
            this.subscriptionId = newSubscriptionId;
          }
        }
      }

      var __typeError$a = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$a = (obj, member, msg) => member.has(obj) || __typeError$a("Cannot " + msg);
      var __privateGet$a = (obj, member, getter) => (__accessCheck$a(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$a = (obj, member, value) => member.has(obj) ? __typeError$a("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$9 = (obj, member, value, setter) => (__accessCheck$a(obj, member, "write to private field"), member.set(obj, value), value);
      var __privateMethod$3 = (obj, member, method) => (__accessCheck$a(obj, member, "access private method"), method);
      var _requestId, _options, _websocketClient, _JsonRpcHTTPTransport_instances, getWebsocketClient_fn;
      class JsonRpcHTTPTransport {
        constructor(options) {
          __privateAdd$a(this, _JsonRpcHTTPTransport_instances);
          __privateAdd$a(this, _requestId, 0);
          __privateAdd$a(this, _options);
          __privateAdd$a(this, _websocketClient);
          __privateSet$9(this, _options, options);
        }
        fetch(input, init) {
          const fetchFn = __privateGet$a(this, _options).fetch ?? fetch;
          if (!fetchFn) {
            throw new Error(
              "The current environment does not support fetch, you can provide a fetch implementation in the options for SuiHTTPTransport."
            );
          }
          return fetchFn(input, init);
        }
        async request(input) {
          __privateSet$9(this, _requestId, __privateGet$a(this, _requestId) + 1);
          const res = await this.fetch(__privateGet$a(this, _options).rpc?.url ?? __privateGet$a(this, _options).url, {
            method: "POST",
            signal: input.signal,
            headers: {
              "Content-Type": "application/json",
              "Client-Sdk-Type": "typescript",
              "Client-Sdk-Version": PACKAGE_VERSION,
              "Client-Target-Api-Version": TARGETED_RPC_VERSION,
              "Client-Request-Method": input.method,
              ...__privateGet$a(this, _options).rpc?.headers
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: __privateGet$a(this, _requestId),
              method: input.method,
              params: input.params
            })
          });
          if (!res.ok) {
            throw new SuiHTTPStatusError(
              `Unexpected status code: ${res.status}`,
              res.status,
              res.statusText
            );
          }
          const data = await res.json();
          if ("error" in data && data.error != null) {
            throw new JsonRpcError(data.error.message, data.error.code);
          }
          return data.result;
        }
        async subscribe(input) {
          const unsubscribe = await __privateMethod$3(this, _JsonRpcHTTPTransport_instances, getWebsocketClient_fn).call(this).subscribe(input);
          if (input.signal) {
            input.signal.throwIfAborted();
            input.signal.addEventListener("abort", () => {
              unsubscribe();
            });
          }
          return async () => !!await unsubscribe();
        }
      } exports("SuiHTTPTransport", JsonRpcHTTPTransport);
      _requestId = new WeakMap();
      _options = new WeakMap();
      _websocketClient = new WeakMap();
      _JsonRpcHTTPTransport_instances = new WeakSet();
      getWebsocketClient_fn = function() {
        if (!__privateGet$a(this, _websocketClient)) {
          const WebSocketConstructor = __privateGet$a(this, _options).WebSocketConstructor ?? WebSocket;
          if (!WebSocketConstructor) {
            throw new Error(
              "The current environment does not support WebSocket, you can provide a WebSocketConstructor in the options for SuiHTTPTransport."
            );
          }
          __privateSet$9(this, _websocketClient, new WebsocketClient(
            __privateGet$a(this, _options).websocket?.url ?? __privateGet$a(this, _options).url,
            {
              WebSocketConstructor,
              ...__privateGet$a(this, _options).websocket
            }
          ));
        }
        return __privateGet$a(this, _websocketClient);
      };

      function getFullnodeUrl(network) {
        switch (network) {
          case "mainnet":
            return "https://fullnode.mainnet.sui.io:443";
          case "testnet":
            return "https://fullnode.testnet.sui.io:443";
          case "devnet":
            return "https://fullnode.devnet.sui.io:443";
          case "localnet":
            return "http://127.0.0.1:9000";
          default:
            throw new Error(`Unknown network: ${network}`);
        }
      }

      /*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
      function isBytes$1(a) {
          return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
      }
      function isArrayOf(isString, arr) {
          if (!Array.isArray(arr))
              return false;
          if (arr.length === 0)
              return true;
          if (isString) {
              return arr.every((item) => typeof item === 'string');
          }
          else {
              return arr.every((item) => Number.isSafeInteger(item));
          }
      }
      // no abytes: seems to have 10% slowdown. Why?!
      function afn(input) {
          if (typeof input !== 'function')
              throw new Error('function expected');
          return true;
      }
      function astr(label, input) {
          if (typeof input !== 'string')
              throw new Error(`${label}: string expected`);
          return true;
      }
      function anumber$1(n) {
          if (!Number.isSafeInteger(n))
              throw new Error(`invalid integer: ${n}`);
      }
      function aArr(input) {
          if (!Array.isArray(input))
              throw new Error('array expected');
      }
      function astrArr(label, input) {
          if (!isArrayOf(true, input))
              throw new Error(`${label}: array of strings expected`);
      }
      function anumArr(label, input) {
          if (!isArrayOf(false, input))
              throw new Error(`${label}: array of numbers expected`);
      }
      /**
       * @__NO_SIDE_EFFECTS__
       */
      function chain(...args) {
          const id = (a) => a;
          // Wrap call in closure so JIT can inline calls
          const wrap = (a, b) => (c) => a(b(c));
          // Construct chain of args[-1].encode(args[-2].encode([...]))
          const encode = args.map((x) => x.encode).reduceRight(wrap, id);
          // Construct chain of args[0].decode(args[1].decode(...))
          const decode = args.map((x) => x.decode).reduce(wrap, id);
          return { encode, decode };
      }
      /**
       * Encodes integer radix representation to array of strings using alphabet and back.
       * Could also be array of strings.
       * @__NO_SIDE_EFFECTS__
       */
      function alphabet(letters) {
          // mapping 1 to "b"
          const lettersA = typeof letters === 'string' ? letters.split('') : letters;
          const len = lettersA.length;
          astrArr('alphabet', lettersA);
          // mapping "b" to 1
          const indexes = new Map(lettersA.map((l, i) => [l, i]));
          return {
              encode: (digits) => {
                  aArr(digits);
                  return digits.map((i) => {
                      if (!Number.isSafeInteger(i) || i < 0 || i >= len)
                          throw new Error(`alphabet.encode: digit index outside alphabet "${i}". Allowed: ${letters}`);
                      return lettersA[i];
                  });
              },
              decode: (input) => {
                  aArr(input);
                  return input.map((letter) => {
                      astr('alphabet.decode', letter);
                      const i = indexes.get(letter);
                      if (i === undefined)
                          throw new Error(`Unknown letter: "${letter}". Allowed: ${letters}`);
                      return i;
                  });
              },
          };
      }
      /**
       * @__NO_SIDE_EFFECTS__
       */
      function join(separator = '') {
          astr('join', separator);
          return {
              encode: (from) => {
                  astrArr('join.decode', from);
                  return from.join(separator);
              },
              decode: (to) => {
                  astr('join.decode', to);
                  return to.split(separator);
              },
          };
      }
      /**
       * Slow: O(n^2) time complexity
       */
      function convertRadix(data, from, to) {
          // base 1 is impossible
          if (from < 2)
              throw new Error(`convertRadix: invalid from=${from}, base cannot be less than 2`);
          if (to < 2)
              throw new Error(`convertRadix: invalid to=${to}, base cannot be less than 2`);
          aArr(data);
          if (!data.length)
              return [];
          let pos = 0;
          const res = [];
          const digits = Array.from(data, (d) => {
              anumber$1(d);
              if (d < 0 || d >= from)
                  throw new Error(`invalid integer: ${d}`);
              return d;
          });
          const dlen = digits.length;
          while (true) {
              let carry = 0;
              let done = true;
              for (let i = pos; i < dlen; i++) {
                  const digit = digits[i];
                  const fromCarry = from * carry;
                  const digitBase = fromCarry + digit;
                  if (!Number.isSafeInteger(digitBase) ||
                      fromCarry / from !== carry ||
                      digitBase - digit !== fromCarry) {
                      throw new Error('convertRadix: carry overflow');
                  }
                  const div = digitBase / to;
                  carry = digitBase % to;
                  const rounded = Math.floor(div);
                  digits[i] = rounded;
                  if (!Number.isSafeInteger(rounded) || rounded * to + carry !== digitBase)
                      throw new Error('convertRadix: carry overflow');
                  if (!done)
                      continue;
                  else if (!rounded)
                      pos = i;
                  else
                      done = false;
              }
              res.push(carry);
              if (done)
                  break;
          }
          for (let i = 0; i < data.length - 1 && data[i] === 0; i++)
              res.push(0);
          return res.reverse();
      }
      const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
      const radix2carry = /* @__NO_SIDE_EFFECTS__ */ (from, to) => from + (to - gcd(from, to));
      const powers = /* @__PURE__ */ (() => {
          let res = [];
          for (let i = 0; i < 40; i++)
              res.push(2 ** i);
          return res;
      })();
      /**
       * Implemented with numbers, because BigInt is 5x slower
       */
      function convertRadix2(data, from, to, padding) {
          aArr(data);
          if (from <= 0 || from > 32)
              throw new Error(`convertRadix2: wrong from=${from}`);
          if (to <= 0 || to > 32)
              throw new Error(`convertRadix2: wrong to=${to}`);
          if (radix2carry(from, to) > 32) {
              throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry(from, to)}`);
          }
          let carry = 0;
          let pos = 0; // bitwise position in current element
          const max = powers[from];
          const mask = powers[to] - 1;
          const res = [];
          for (const n of data) {
              anumber$1(n);
              if (n >= max)
                  throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
              carry = (carry << from) | n;
              if (pos + from > 32)
                  throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
              pos += from;
              for (; pos >= to; pos -= to)
                  res.push(((carry >> (pos - to)) & mask) >>> 0);
              const pow = powers[pos];
              if (pow === undefined)
                  throw new Error('invalid carry');
              carry &= pow - 1; // clean carry, otherwise it will cause overflow
          }
          carry = (carry << (to - pos)) & mask;
          if (!padding && pos >= from)
              throw new Error('Excess padding');
          if (!padding && carry > 0)
              throw new Error(`Non-zero padding: ${carry}`);
          if (padding && pos > 0)
              res.push(carry >>> 0);
          return res;
      }
      /**
       * @__NO_SIDE_EFFECTS__
       */
      function radix(num) {
          anumber$1(num);
          const _256 = 2 ** 8;
          return {
              encode: (bytes) => {
                  if (!isBytes$1(bytes))
                      throw new Error('radix.encode input should be Uint8Array');
                  return convertRadix(Array.from(bytes), _256, num);
              },
              decode: (digits) => {
                  anumArr('radix.decode', digits);
                  return Uint8Array.from(convertRadix(digits, num, _256));
              },
          };
      }
      /**
       * If both bases are power of same number (like `2**8 <-> 2**64`),
       * there is a linear algorithm. For now we have implementation for power-of-two bases only.
       * @__NO_SIDE_EFFECTS__
       */
      function radix2(bits, revPadding = false) {
          anumber$1(bits);
          if (bits <= 0 || bits > 32)
              throw new Error('radix2: bits should be in (0..32]');
          if (radix2carry(8, bits) > 32 || radix2carry(bits, 8) > 32)
              throw new Error('radix2: carry overflow');
          return {
              encode: (bytes) => {
                  if (!isBytes$1(bytes))
                      throw new Error('radix2.encode input should be Uint8Array');
                  return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
              },
              decode: (digits) => {
                  anumArr('radix2.decode', digits);
                  return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
              },
          };
      }
      function unsafeWrapper(fn) {
          afn(fn);
          return function (...args) {
              try {
                  return fn.apply(null, args);
              }
              catch (e) { }
          };
      }
      // base58 code
      // -----------
      const genBase58 = /* @__NO_SIDE_EFFECTS__ */ (abc) => chain(radix(58), alphabet(abc), join(''));
      /**
       * base58: base64 without ambigous characters +, /, 0, O, I, l.
       * Quadratic (O(n^2)) - so, can't be used on large inputs.
       * @example
       * ```js
       * base58.decode('01abcdef');
       * // => '3UhJW'
       * ```
       */
      const base58 = genBase58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
      const BECH_ALPHABET = chain(alphabet('qpzry9x8gf2tvdw0s3jn54khce6mua7l'), join(''));
      const POLYMOD_GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
      function bech32Polymod(pre) {
          const b = pre >> 25;
          let chk = (pre & 0x1ffffff) << 5;
          for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
              if (((b >> i) & 1) === 1)
                  chk ^= POLYMOD_GENERATORS[i];
          }
          return chk;
      }
      function bechChecksum(prefix, words, encodingConst = 1) {
          const len = prefix.length;
          let chk = 1;
          for (let i = 0; i < len; i++) {
              const c = prefix.charCodeAt(i);
              if (c < 33 || c > 126)
                  throw new Error(`Invalid prefix (${prefix})`);
              chk = bech32Polymod(chk) ^ (c >> 5);
          }
          chk = bech32Polymod(chk);
          for (let i = 0; i < len; i++)
              chk = bech32Polymod(chk) ^ (prefix.charCodeAt(i) & 0x1f);
          for (let v of words)
              chk = bech32Polymod(chk) ^ v;
          for (let i = 0; i < 6; i++)
              chk = bech32Polymod(chk);
          chk ^= encodingConst;
          return BECH_ALPHABET.encode(convertRadix2([chk % powers[30]], 30, 5, false));
      }
      /**
       * @__NO_SIDE_EFFECTS__
       */
      function genBech32(encoding) {
          const ENCODING_CONST = encoding === 'bech32' ? 1 : 0x2bc830a3;
          const _words = radix2(5);
          const fromWords = _words.decode;
          const toWords = _words.encode;
          const fromWordsUnsafe = unsafeWrapper(fromWords);
          function encode(prefix, words, limit = 90) {
              astr('bech32.encode prefix', prefix);
              if (isBytes$1(words))
                  words = Array.from(words);
              anumArr('bech32.encode', words);
              const plen = prefix.length;
              if (plen === 0)
                  throw new TypeError(`Invalid prefix length ${plen}`);
              const actualLength = plen + 7 + words.length;
              if (limit !== false && actualLength > limit)
                  throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
              const lowered = prefix.toLowerCase();
              const sum = bechChecksum(lowered, words, ENCODING_CONST);
              return `${lowered}1${BECH_ALPHABET.encode(words)}${sum}`;
          }
          function decode(str, limit = 90) {
              astr('bech32.decode input', str);
              const slen = str.length;
              if (slen < 8 || (limit !== false && slen > limit))
                  throw new TypeError(`invalid string length: ${slen} (${str}). Expected (8..${limit})`);
              // don't allow mixed case
              const lowered = str.toLowerCase();
              if (str !== lowered && str !== str.toUpperCase())
                  throw new Error(`String must be lowercase or uppercase`);
              const sepIndex = lowered.lastIndexOf('1');
              if (sepIndex === 0 || sepIndex === -1)
                  throw new Error(`Letter "1" must be present between prefix and data only`);
              const prefix = lowered.slice(0, sepIndex);
              const data = lowered.slice(sepIndex + 1);
              if (data.length < 6)
                  throw new Error('Data must be at least 6 characters long');
              const words = BECH_ALPHABET.decode(data).slice(0, -6);
              const sum = bechChecksum(prefix, words, ENCODING_CONST);
              if (!data.endsWith(sum))
                  throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
              return { prefix, words };
          }
          const decodeUnsafe = unsafeWrapper(decode);
          function decodeToBytes(str) {
              const { prefix, words } = decode(str, false);
              return { prefix, words, bytes: fromWords(words) };
          }
          function encodeFromBytes(prefix, bytes) {
              return encode(prefix, toWords(bytes));
          }
          return {
              encode,
              decode,
              encodeFromBytes,
              decodeToBytes,
              decodeUnsafe,
              fromWords,
              fromWordsUnsafe,
              toWords,
          };
      }
      /**
       * bech32 from BIP 173. Operates on words.
       * For high-level, check out scure-btc-signer:
       * https://github.com/paulmillr/scure-btc-signer.
       */
      const bech32 = genBech32('bech32');

      const toBase58 = exports("toBase58", (buffer) => base58.encode(buffer));
      const fromBase58 = exports("fromBase58", (str) => base58.decode(str));

      function fromBase64(base64String) {
        return Uint8Array.from(atob(base64String), (char) => char.charCodeAt(0));
      }
      const CHUNK_SIZE = 8192;
      function toBase64(bytes) {
        if (bytes.length < CHUNK_SIZE) {
          return btoa(String.fromCharCode(...bytes));
        }
        let output = "";
        for (var i = 0; i < bytes.length; i += CHUNK_SIZE) {
          const chunk = bytes.slice(i, i + CHUNK_SIZE);
          output += String.fromCharCode(...chunk);
        }
        return btoa(output);
      }

      function fromHex(hexStr) {
        const normalized = hexStr.startsWith("0x") ? hexStr.slice(2) : hexStr;
        const padded = normalized.length % 2 === 0 ? normalized : `0${normalized}`;
        const intArr = padded.match(/[0-9a-fA-F]{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
        if (intArr.length !== padded.length / 2) {
          throw new Error(`Invalid hex string ${hexStr}`);
        }
        return Uint8Array.from(intArr);
      }
      function toHex(bytes) {
        return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
      }

      function chunk(array, size) {
        return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => {
          return array.slice(i * size, (i + 1) * size);
        });
      }

      function promiseWithResolvers() {
        let resolver;
        let rejecter;
        const promise = new Promise((resolve, reject) => {
          resolver = resolve;
          rejecter = reject;
        });
        return {
          promise,
          resolve: resolver,
          reject: rejecter
        };
      }

      class DataLoader {
        constructor(batchLoadFn, options) {
          if (typeof batchLoadFn !== "function") {
            throw new TypeError(
              `DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but got: ${batchLoadFn}.`
            );
          }
          this._batchLoadFn = batchLoadFn;
          this._maxBatchSize = getValidMaxBatchSize(options);
          this._batchScheduleFn = getValidBatchScheduleFn(options);
          this._cacheKeyFn = getValidCacheKeyFn(options);
          this._cacheMap = getValidCacheMap(options);
          this._batch = null;
          this.name = getValidName(options);
        }
        /**
         * Loads a key, returning a `Promise` for the value represented by that key.
         */
        load(key) {
          if (key === null || key === void 0) {
            throw new TypeError(
              `The loader.load() function must be called with a value, but got: ${String(key)}.`
            );
          }
          const batch = getCurrentBatch(this);
          const cacheMap = this._cacheMap;
          let cacheKey;
          if (cacheMap) {
            cacheKey = this._cacheKeyFn(key);
            const cachedPromise = cacheMap.get(cacheKey);
            if (cachedPromise) {
              const cacheHits = batch.cacheHits || (batch.cacheHits = []);
              return new Promise((resolve) => {
                cacheHits.push(() => {
                  resolve(cachedPromise);
                });
              });
            }
          }
          batch.keys.push(key);
          const promise = new Promise((resolve, reject) => {
            batch.callbacks.push({ resolve, reject });
          });
          if (cacheMap) {
            cacheMap.set(cacheKey, promise);
          }
          return promise;
        }
        /**
         * Loads multiple keys, promising an array of values:
         *
         *     var [ a, b ] = await myLoader.loadMany([ 'a', 'b' ]);
         *
         * This is similar to the more verbose:
         *
         *     var [ a, b ] = await Promise.all([
         *       myLoader.load('a'),
         *       myLoader.load('b')
         *     ]);
         *
         * However it is different in the case where any load fails. Where
         * Promise.all() would reject, loadMany() always resolves, however each result
         * is either a value or an Error instance.
         *
         *     var [ a, b, c ] = await myLoader.loadMany([ 'a', 'b', 'badkey' ]);
         *     // c instanceof Error
         *
         */
        loadMany(keys) {
          if (!isArrayLike(keys)) {
            throw new TypeError(
              `The loader.loadMany() function must be called with Array<key>, but got: ${keys}.`
            );
          }
          const loadPromises = [];
          for (let i = 0; i < keys.length; i++) {
            loadPromises.push(this.load(keys[i]).catch((error) => error));
          }
          return Promise.all(loadPromises);
        }
        /**
         * Clears the value at `key` from the cache, if it exists. Returns itself for
         * method chaining.
         */
        clear(key) {
          const cacheMap = this._cacheMap;
          if (cacheMap) {
            const cacheKey = this._cacheKeyFn(key);
            cacheMap.delete(cacheKey);
          }
          return this;
        }
        /**
         * Clears the entire cache. To be used when some event results in unknown
         * invalidations across this particular `DataLoader`. Returns itself for
         * method chaining.
         */
        clearAll() {
          const cacheMap = this._cacheMap;
          if (cacheMap) {
            cacheMap.clear();
          }
          return this;
        }
        /**
         * Adds the provided key and value to the cache. If the key already
         * exists, no change is made. Returns itself for method chaining.
         *
         * To prime the cache with an error at a key, provide an Error instance.
         */
        prime(key, value) {
          const cacheMap = this._cacheMap;
          if (cacheMap) {
            const cacheKey = this._cacheKeyFn(key);
            if (cacheMap.get(cacheKey) === void 0) {
              let promise;
              if (value instanceof Error) {
                promise = Promise.reject(value);
                promise.catch(() => {
                });
              } else {
                promise = Promise.resolve(value);
              }
              cacheMap.set(cacheKey, promise);
            }
          }
          return this;
        }
      }
      const enqueuePostPromiseJob = (
        /** @ts-ignore */
        typeof process === "object" && typeof process.nextTick === "function" ? function(fn) {
          if (!resolvedPromise) {
            resolvedPromise = Promise.resolve();
          }
          resolvedPromise.then(() => {
            process.nextTick(fn);
          });
        } : (
          // @ts-ignore
          typeof setImmediate === "function" ? function(fn) {
            setImmediate(fn);
          } : function(fn) {
            setTimeout(fn);
          }
        )
      );
      let resolvedPromise;
      function getCurrentBatch(loader) {
        const existingBatch = loader._batch;
        if (existingBatch !== null && !existingBatch.hasDispatched && existingBatch.keys.length < loader._maxBatchSize) {
          return existingBatch;
        }
        const newBatch = { hasDispatched: false, keys: [], callbacks: [] };
        loader._batch = newBatch;
        loader._batchScheduleFn(() => {
          dispatchBatch(loader, newBatch);
        });
        return newBatch;
      }
      function dispatchBatch(loader, batch) {
        batch.hasDispatched = true;
        if (batch.keys.length === 0) {
          resolveCacheHits(batch);
          return;
        }
        let batchPromise;
        try {
          batchPromise = loader._batchLoadFn(batch.keys);
        } catch (e) {
          return failedDispatch(
            loader,
            batch,
            new TypeError(
              `DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function errored synchronously: ${String(e)}.`
            )
          );
        }
        if (!batchPromise || typeof batchPromise.then !== "function") {
          return failedDispatch(
            loader,
            batch,
            new TypeError(
              `DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise: ${String(batchPromise)}.`
            )
          );
        }
        Promise.resolve(batchPromise).then((values) => {
          if (!isArrayLike(values)) {
            throw new TypeError(
              `DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise of an Array: ${String(values)}.`
            );
          }
          if (values.length !== batch.keys.length) {
            throw new TypeError(
              `DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise of an Array of the same length as the Array of keys.

Keys:
${String(batch.keys)}

Values:
${String(values)}`
            );
          }
          resolveCacheHits(batch);
          for (let i = 0; i < batch.callbacks.length; i++) {
            const value = values[i];
            if (value instanceof Error) {
              batch.callbacks[i].reject(value);
            } else {
              batch.callbacks[i].resolve(value);
            }
          }
        }).catch((error) => {
          failedDispatch(loader, batch, error);
        });
      }
      function failedDispatch(loader, batch, error) {
        resolveCacheHits(batch);
        for (let i = 0; i < batch.keys.length; i++) {
          loader.clear(batch.keys[i]);
          batch.callbacks[i].reject(error);
        }
      }
      function resolveCacheHits(batch) {
        if (batch.cacheHits) {
          for (let i = 0; i < batch.cacheHits.length; i++) {
            batch.cacheHits[i]();
          }
        }
      }
      function getValidMaxBatchSize(options) {
        const shouldBatch = !options || options.batch !== false;
        if (!shouldBatch) {
          return 1;
        }
        const maxBatchSize = options && options.maxBatchSize;
        if (maxBatchSize === void 0) {
          return Infinity;
        }
        if (typeof maxBatchSize !== "number" || maxBatchSize < 1) {
          throw new TypeError(`maxBatchSize must be a positive number: ${maxBatchSize}`);
        }
        return maxBatchSize;
      }
      function getValidBatchScheduleFn(options) {
        const batchScheduleFn = options && options.batchScheduleFn;
        if (batchScheduleFn === void 0) {
          return enqueuePostPromiseJob;
        }
        if (typeof batchScheduleFn !== "function") {
          throw new TypeError(`batchScheduleFn must be a function: ${batchScheduleFn}`);
        }
        return batchScheduleFn;
      }
      function getValidCacheKeyFn(options) {
        const cacheKeyFn = options && options.cacheKeyFn;
        if (cacheKeyFn === void 0) {
          return (key) => key;
        }
        if (typeof cacheKeyFn !== "function") {
          throw new TypeError(`cacheKeyFn must be a function: ${cacheKeyFn}`);
        }
        return cacheKeyFn;
      }
      function getValidCacheMap(options) {
        const shouldCache = !options || options.cache !== false;
        if (!shouldCache) {
          return null;
        }
        const cacheMap = options && options.cacheMap;
        if (cacheMap === void 0) {
          return /* @__PURE__ */ new Map();
        }
        if (cacheMap !== null) {
          const cacheFunctions = ["get", "set", "delete", "clear"];
          const missingFunctions = cacheFunctions.filter(
            (fnName) => cacheMap && typeof cacheMap[fnName] !== "function"
          );
          if (missingFunctions.length !== 0) {
            throw new TypeError("Custom cacheMap missing methods: " + missingFunctions.join(", "));
          }
        }
        return cacheMap;
      }
      function getValidName(options) {
        if (options && options.name) {
          return options.name;
        }
        return null;
      }
      function isArrayLike(x) {
        return typeof x === "object" && x !== null && "length" in x && typeof x.length === "number" && (x.length === 0 || x.length > 0 && Object.prototype.hasOwnProperty.call(x, x.length - 1));
      }

      function ulebEncode(num) {
        const arr = [];
        let len = 0;
        if (num === 0) {
          return [0];
        }
        while (num > 0) {
          arr[len] = num & 127;
          if (num >>= 7) {
            arr[len] |= 128;
          }
          len += 1;
        }
        return arr;
      }
      function ulebDecode(arr) {
        let total = 0;
        let shift = 0;
        let len = 0;
        while (true) {
          const byte = arr[len];
          len += 1;
          total |= (byte & 127) << shift;
          if ((byte & 128) === 0) {
            break;
          }
          shift += 7;
        }
        return {
          value: total,
          length: len
        };
      }

      class BcsReader {
        /**
         * @param {Uint8Array} data Data to use as a buffer.
         */
        constructor(data) {
          this.bytePosition = 0;
          this.dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
        }
        /**
         * Shift current cursor position by `bytes`.
         *
         * @param {Number} bytes Number of bytes to
         * @returns {this} Self for possible chaining.
         */
        shift(bytes) {
          this.bytePosition += bytes;
          return this;
        }
        /**
         * Read U8 value from the buffer and shift cursor by 1.
         * @returns
         */
        read8() {
          const value = this.dataView.getUint8(this.bytePosition);
          this.shift(1);
          return value;
        }
        /**
         * Read U16 value from the buffer and shift cursor by 2.
         * @returns
         */
        read16() {
          const value = this.dataView.getUint16(this.bytePosition, true);
          this.shift(2);
          return value;
        }
        /**
         * Read U32 value from the buffer and shift cursor by 4.
         * @returns
         */
        read32() {
          const value = this.dataView.getUint32(this.bytePosition, true);
          this.shift(4);
          return value;
        }
        /**
         * Read U64 value from the buffer and shift cursor by 8.
         * @returns
         */
        read64() {
          const value1 = this.read32();
          const value2 = this.read32();
          const result = value2.toString(16) + value1.toString(16).padStart(8, "0");
          return BigInt("0x" + result).toString(10);
        }
        /**
         * Read U128 value from the buffer and shift cursor by 16.
         */
        read128() {
          const value1 = BigInt(this.read64());
          const value2 = BigInt(this.read64());
          const result = value2.toString(16) + value1.toString(16).padStart(16, "0");
          return BigInt("0x" + result).toString(10);
        }
        /**
         * Read U128 value from the buffer and shift cursor by 32.
         * @returns
         */
        read256() {
          const value1 = BigInt(this.read128());
          const value2 = BigInt(this.read128());
          const result = value2.toString(16) + value1.toString(16).padStart(32, "0");
          return BigInt("0x" + result).toString(10);
        }
        /**
         * Read `num` number of bytes from the buffer and shift cursor by `num`.
         * @param num Number of bytes to read.
         */
        readBytes(num) {
          const start = this.bytePosition + this.dataView.byteOffset;
          const value = new Uint8Array(this.dataView.buffer, start, num);
          this.shift(num);
          return value;
        }
        /**
         * Read ULEB value - an integer of varying size. Used for enum indexes and
         * vector lengths.
         * @returns {Number} The ULEB value.
         */
        readULEB() {
          const start = this.bytePosition + this.dataView.byteOffset;
          const buffer = new Uint8Array(this.dataView.buffer, start);
          const { value, length } = ulebDecode(buffer);
          this.shift(length);
          return value;
        }
        /**
         * Read a BCS vector: read a length and then apply function `cb` X times
         * where X is the length of the vector, defined as ULEB in BCS bytes.
         * @param cb Callback to process elements of vector.
         * @returns {Array<Any>} Array of the resulting values, returned by callback.
         */
        readVec(cb) {
          const length = this.readULEB();
          const result = [];
          for (let i = 0; i < length; i++) {
            result.push(cb(this, i, length));
          }
          return result;
        }
      }

      function encodeStr(data, encoding) {
        switch (encoding) {
          case "base58":
            return toBase58(data);
          case "base64":
            return toBase64(data);
          case "hex":
            return toHex(data);
          default:
            throw new Error("Unsupported encoding, supported values are: base64, hex");
        }
      }
      function splitGenericParameters(str, genericSeparators = ["<", ">"]) {
        const [left, right] = genericSeparators;
        const tok = [];
        let word = "";
        let nestedAngleBrackets = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (char === left) {
            nestedAngleBrackets++;
          }
          if (char === right) {
            nestedAngleBrackets--;
          }
          if (nestedAngleBrackets === 0 && char === ",") {
            tok.push(word.trim());
            word = "";
            continue;
          }
          word += char;
        }
        tok.push(word.trim());
        return tok;
      }

      class BcsWriter {
        constructor({
          initialSize = 1024,
          maxSize = Infinity,
          allocateSize = 1024
        } = {}) {
          this.bytePosition = 0;
          this.size = initialSize;
          this.maxSize = maxSize;
          this.allocateSize = allocateSize;
          this.dataView = new DataView(new ArrayBuffer(initialSize));
        }
        ensureSizeOrGrow(bytes) {
          const requiredSize = this.bytePosition + bytes;
          if (requiredSize > this.size) {
            const nextSize = Math.min(this.maxSize, this.size + this.allocateSize);
            if (requiredSize > nextSize) {
              throw new Error(
                `Attempting to serialize to BCS, but buffer does not have enough size. Allocated size: ${this.size}, Max size: ${this.maxSize}, Required size: ${requiredSize}`
              );
            }
            this.size = nextSize;
            const nextBuffer = new ArrayBuffer(this.size);
            new Uint8Array(nextBuffer).set(new Uint8Array(this.dataView.buffer));
            this.dataView = new DataView(nextBuffer);
          }
        }
        /**
         * Shift current cursor position by `bytes`.
         *
         * @param {Number} bytes Number of bytes to
         * @returns {this} Self for possible chaining.
         */
        shift(bytes) {
          this.bytePosition += bytes;
          return this;
        }
        /**
         * Write a U8 value into a buffer and shift cursor position by 1.
         * @param {Number} value Value to write.
         * @returns {this}
         */
        write8(value) {
          this.ensureSizeOrGrow(1);
          this.dataView.setUint8(this.bytePosition, Number(value));
          return this.shift(1);
        }
        /**
         * Write a U16 value into a buffer and shift cursor position by 2.
         * @param {Number} value Value to write.
         * @returns {this}
         */
        write16(value) {
          this.ensureSizeOrGrow(2);
          this.dataView.setUint16(this.bytePosition, Number(value), true);
          return this.shift(2);
        }
        /**
         * Write a U32 value into a buffer and shift cursor position by 4.
         * @param {Number} value Value to write.
         * @returns {this}
         */
        write32(value) {
          this.ensureSizeOrGrow(4);
          this.dataView.setUint32(this.bytePosition, Number(value), true);
          return this.shift(4);
        }
        /**
         * Write a U64 value into a buffer and shift cursor position by 8.
         * @param {bigint} value Value to write.
         * @returns {this}
         */
        write64(value) {
          toLittleEndian(BigInt(value), 8).forEach((el) => this.write8(el));
          return this;
        }
        /**
         * Write a U128 value into a buffer and shift cursor position by 16.
         *
         * @param {bigint} value Value to write.
         * @returns {this}
         */
        write128(value) {
          toLittleEndian(BigInt(value), 16).forEach((el) => this.write8(el));
          return this;
        }
        /**
         * Write a U256 value into a buffer and shift cursor position by 16.
         *
         * @param {bigint} value Value to write.
         * @returns {this}
         */
        write256(value) {
          toLittleEndian(BigInt(value), 32).forEach((el) => this.write8(el));
          return this;
        }
        /**
         * Write a ULEB value into a buffer and shift cursor position by number of bytes
         * written.
         * @param {Number} value Value to write.
         * @returns {this}
         */
        writeULEB(value) {
          ulebEncode(value).forEach((el) => this.write8(el));
          return this;
        }
        /**
         * Write a vector into a buffer by first writing the vector length and then calling
         * a callback on each passed value.
         *
         * @param {Array<Any>} vector Array of elements to write.
         * @param {WriteVecCb} cb Callback to call on each element of the vector.
         * @returns {this}
         */
        writeVec(vector, cb) {
          this.writeULEB(vector.length);
          Array.from(vector).forEach((el, i) => cb(this, el, i, vector.length));
          return this;
        }
        /**
         * Adds support for iterations over the object.
         * @returns {Uint8Array}
         */
        // oxlint-disable-next-line require-yields
        *[Symbol.iterator]() {
          for (let i = 0; i < this.bytePosition; i++) {
            yield this.dataView.getUint8(i);
          }
          return this.toBytes();
        }
        /**
         * Get underlying buffer taking only value bytes (in case initial buffer size was bigger).
         * @returns {Uint8Array} Resulting bcs.
         */
        toBytes() {
          return new Uint8Array(this.dataView.buffer.slice(0, this.bytePosition));
        }
        /**
         * Represent data as 'hex' or 'base64'
         * @param encoding Encoding to use: 'base64' or 'hex'
         */
        toString(encoding) {
          return encodeStr(this.toBytes(), encoding);
        }
      }
      function toLittleEndian(bigint, size) {
        const result = new Uint8Array(size);
        let i = 0;
        while (bigint > 0) {
          result[i] = Number(bigint % BigInt(256));
          bigint = bigint / BigInt(256);
          i += 1;
        }
        return result;
      }

      var __typeError$9 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$9 = (obj, member, msg) => member.has(obj) || __typeError$9("Cannot " + msg);
      var __privateGet$9 = (obj, member, getter) => (__accessCheck$9(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$9 = (obj, member, value) => member.has(obj) ? __typeError$9("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$8 = (obj, member, value, setter) => (__accessCheck$9(obj, member, "write to private field"), member.set(obj, value), value);
      var _write, _serialize, _schema, _bytes;
      const _BcsType = class _BcsType {
        constructor(options) {
          __privateAdd$9(this, _write);
          __privateAdd$9(this, _serialize);
          this.name = options.name;
          this.read = options.read;
          this.serializedSize = options.serializedSize ?? (() => null);
          __privateSet$8(this, _write, options.write);
          __privateSet$8(this, _serialize, options.serialize ?? ((value, options2) => {
            const writer = new BcsWriter({
              initialSize: this.serializedSize(value) ?? void 0,
              ...options2
            });
            __privateGet$9(this, _write).call(this, value, writer);
            return writer.toBytes();
          }));
          this.validate = options.validate ?? (() => {
          });
        }
        write(value, writer) {
          this.validate(value);
          __privateGet$9(this, _write).call(this, value, writer);
        }
        serialize(value, options) {
          this.validate(value);
          return new SerializedBcs(this, __privateGet$9(this, _serialize).call(this, value, options));
        }
        parse(bytes) {
          const reader = new BcsReader(bytes);
          return this.read(reader);
        }
        fromHex(hex) {
          return this.parse(fromHex(hex));
        }
        fromBase58(b64) {
          return this.parse(fromBase58(b64));
        }
        fromBase64(b64) {
          return this.parse(fromBase64(b64));
        }
        transform({
          name,
          input,
          output,
          validate
        }) {
          return new _BcsType({
            name: name ?? this.name,
            read: (reader) => output ? output(this.read(reader)) : this.read(reader),
            write: (value, writer) => __privateGet$9(this, _write).call(this, input ? input(value) : value, writer),
            serializedSize: (value) => this.serializedSize(input ? input(value) : value),
            serialize: (value, options) => __privateGet$9(this, _serialize).call(this, input ? input(value) : value, options),
            validate: (value) => {
              validate?.(value);
              this.validate(input ? input(value) : value);
            }
          });
        }
      };
      _write = new WeakMap();
      _serialize = new WeakMap();
      let BcsType = exports("BcsType", _BcsType);
      const SERIALIZED_BCS_BRAND = Symbol.for("@mysten/serialized-bcs");
      function isSerializedBcs(obj) {
        return !!obj && typeof obj === "object" && obj[SERIALIZED_BCS_BRAND] === true;
      }
      class SerializedBcs {
        constructor(schema, bytes) {
          __privateAdd$9(this, _schema);
          __privateAdd$9(this, _bytes);
          __privateSet$8(this, _schema, schema);
          __privateSet$8(this, _bytes, bytes);
        }
        // Used to brand SerializedBcs so that they can be identified, even between multiple copies
        // of the @mysten/bcs package are installed
        get [SERIALIZED_BCS_BRAND]() {
          return true;
        }
        toBytes() {
          return __privateGet$9(this, _bytes);
        }
        toHex() {
          return toHex(__privateGet$9(this, _bytes));
        }
        toBase64() {
          return toBase64(__privateGet$9(this, _bytes));
        }
        toBase58() {
          return toBase58(__privateGet$9(this, _bytes));
        }
        parse() {
          return __privateGet$9(this, _schema).parse(__privateGet$9(this, _bytes));
        }
      }
      _schema = new WeakMap();
      _bytes = new WeakMap();
      function fixedSizeBcsType({
        size,
        ...options
      }) {
        return new BcsType({
          ...options,
          serializedSize: () => size
        });
      }
      function uIntBcsType({
        readMethod,
        writeMethod,
        ...options
      }) {
        return fixedSizeBcsType({
          ...options,
          read: (reader) => reader[readMethod](),
          write: (value, writer) => writer[writeMethod](value),
          validate: (value) => {
            if (value < 0 || value > options.maxValue) {
              throw new TypeError(
                `Invalid ${options.name} value: ${value}. Expected value in range 0-${options.maxValue}`
              );
            }
            options.validate?.(value);
          }
        });
      }
      function bigUIntBcsType({
        readMethod,
        writeMethod,
        ...options
      }) {
        return fixedSizeBcsType({
          ...options,
          read: (reader) => reader[readMethod](),
          write: (value, writer) => writer[writeMethod](BigInt(value)),
          validate: (val) => {
            const value = BigInt(val);
            if (value < 0 || value > options.maxValue) {
              throw new TypeError(
                `Invalid ${options.name} value: ${value}. Expected value in range 0-${options.maxValue}`
              );
            }
            options.validate?.(value);
          }
        });
      }
      function dynamicSizeBcsType({
        serialize,
        ...options
      }) {
        const type = new BcsType({
          ...options,
          serialize,
          write: (value, writer) => {
            for (const byte of type.serialize(value).toBytes()) {
              writer.write8(byte);
            }
          }
        });
        return type;
      }
      function stringLikeBcsType({
        toBytes,
        fromBytes,
        ...options
      }) {
        return new BcsType({
          ...options,
          read: (reader) => {
            const length = reader.readULEB();
            const bytes = reader.readBytes(length);
            return fromBytes(bytes);
          },
          write: (hex, writer) => {
            const bytes = toBytes(hex);
            writer.writeULEB(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
              writer.write8(bytes[i]);
            }
          },
          serialize: (value) => {
            const bytes = toBytes(value);
            const size = ulebEncode(bytes.length);
            const result = new Uint8Array(size.length + bytes.length);
            result.set(size, 0);
            result.set(bytes, size.length);
            return result;
          },
          validate: (value) => {
            if (typeof value !== "string") {
              throw new TypeError(`Invalid ${options.name} value: ${value}. Expected string`);
            }
            options.validate?.(value);
          }
        });
      }
      function lazyBcsType(cb) {
        let lazyType = null;
        function getType() {
          if (!lazyType) {
            lazyType = cb();
          }
          return lazyType;
        }
        return new BcsType({
          name: "lazy",
          read: (data) => getType().read(data),
          serializedSize: (value) => getType().serializedSize(value),
          write: (value, writer) => getType().write(value, writer),
          serialize: (value, options) => getType().serialize(value, options).toBytes()
        });
      }
      class BcsStruct extends BcsType {
        constructor({ name, fields, ...options }) {
          const canonicalOrder = Object.entries(fields);
          super({
            name,
            serializedSize: (values) => {
              let total = 0;
              for (const [field, type] of canonicalOrder) {
                const size = type.serializedSize(values[field]);
                if (size == null) {
                  return null;
                }
                total += size;
              }
              return total;
            },
            read: (reader) => {
              const result = {};
              for (const [field, type] of canonicalOrder) {
                result[field] = type.read(reader);
              }
              return result;
            },
            write: (value, writer) => {
              for (const [field, type] of canonicalOrder) {
                type.write(value[field], writer);
              }
            },
            ...options,
            validate: (value) => {
              options?.validate?.(value);
              if (typeof value !== "object" || value == null) {
                throw new TypeError(`Expected object, found ${typeof value}`);
              }
            }
          });
        }
      } exports("BcsStruct", BcsStruct);
      class BcsEnum extends BcsType {
        constructor({ fields, ...options }) {
          const canonicalOrder = Object.entries(fields);
          super({
            read: (reader) => {
              const index = reader.readULEB();
              const enumEntry = canonicalOrder[index];
              if (!enumEntry) {
                throw new TypeError(`Unknown value ${index} for enum ${options.name}`);
              }
              const [kind, type] = enumEntry;
              return {
                [kind]: type?.read(reader) ?? true,
                $kind: kind
              };
            },
            write: (value, writer) => {
              const [name, val] = Object.entries(value).filter(
                ([name2]) => Object.hasOwn(fields, name2)
              )[0];
              for (let i = 0; i < canonicalOrder.length; i++) {
                const [optionName, optionType] = canonicalOrder[i];
                if (optionName === name) {
                  writer.writeULEB(i);
                  optionType?.write(val, writer);
                  return;
                }
              }
            },
            ...options,
            validate: (value) => {
              options?.validate?.(value);
              if (typeof value !== "object" || value == null) {
                throw new TypeError(`Expected object, found ${typeof value}`);
              }
              const keys = Object.keys(value).filter(
                (k) => value[k] !== void 0 && Object.hasOwn(fields, k)
              );
              if (keys.length !== 1) {
                throw new TypeError(
                  `Expected object with one key, but found ${keys.length} for type ${options.name}}`
                );
              }
              const [variant] = keys;
              if (!Object.hasOwn(fields, variant)) {
                throw new TypeError(`Invalid enum variant ${variant}`);
              }
            }
          });
        }
      } exports("BcsEnum", BcsEnum);
      class BcsTuple extends BcsType {
        constructor({ fields, name, ...options }) {
          super({
            name: name ?? `(${fields.map((t) => t.name).join(", ")})`,
            serializedSize: (values) => {
              let total = 0;
              for (let i = 0; i < fields.length; i++) {
                const size = fields[i].serializedSize(values[i]);
                if (size == null) {
                  return null;
                }
                total += size;
              }
              return total;
            },
            read: (reader) => {
              const result = [];
              for (const field of fields) {
                result.push(field.read(reader));
              }
              return result;
            },
            write: (value, writer) => {
              for (let i = 0; i < fields.length; i++) {
                fields[i].write(value[i], writer);
              }
            },
            ...options,
            validate: (value) => {
              options?.validate?.(value);
              if (!Array.isArray(value)) {
                throw new TypeError(`Expected array, found ${typeof value}`);
              }
              if (value.length !== fields.length) {
                throw new TypeError(`Expected array of length ${fields.length}, found ${value.length}`);
              }
            }
          });
        }
      } exports("BcsTuple", BcsTuple);

      function fixedArray(size, type, options) {
        return new BcsType({
          read: (reader) => {
            const result = new Array(size);
            for (let i = 0; i < size; i++) {
              result[i] = type.read(reader);
            }
            return result;
          },
          write: (value, writer) => {
            for (const item of value) {
              type.write(item, writer);
            }
          },
          ...options,
          name: options?.name ?? `${type.name}[${size}]`,
          validate: (value) => {
            options?.validate?.(value);
            if (!value || typeof value !== "object" || !("length" in value)) {
              throw new TypeError(`Expected array, found ${typeof value}`);
            }
            if (value.length !== size) {
              throw new TypeError(`Expected array of length ${size}, found ${value.length}`);
            }
          }
        });
      }
      function option(type) {
        return bcs.enum(`Option<${type.name}>`, {
          None: null,
          Some: type
        }).transform({
          input: (value) => {
            if (value == null) {
              return { None: true };
            }
            return { Some: value };
          },
          output: (value) => {
            if (value.$kind === "Some") {
              return value.Some;
            }
            return null;
          }
        });
      }
      function vector(type, options) {
        return new BcsType({
          read: (reader) => {
            const length = reader.readULEB();
            const result = new Array(length);
            for (let i = 0; i < length; i++) {
              result[i] = type.read(reader);
            }
            return result;
          },
          write: (value, writer) => {
            writer.writeULEB(value.length);
            for (const item of value) {
              type.write(item, writer);
            }
          },
          ...options,
          name: options?.name ?? `vector<${type.name}>`,
          validate: (value) => {
            options?.validate?.(value);
            if (!value || typeof value !== "object" || !("length" in value)) {
              throw new TypeError(`Expected array, found ${typeof value}`);
            }
          }
        });
      }
      function map(keyType, valueType) {
        return bcs.vector(bcs.tuple([keyType, valueType])).transform({
          name: `Map<${keyType.name}, ${valueType.name}>`,
          input: (value) => {
            return [...value.entries()];
          },
          output: (value) => {
            const result = /* @__PURE__ */ new Map();
            for (const [key, val] of value) {
              result.set(key, val);
            }
            return result;
          }
        });
      }
      const bcs = {
        /**
         * Creates a BcsType that can be used to read and write an 8-bit unsigned integer.
         * @example
         * bcs.u8().serialize(255).toBytes() // Uint8Array [ 255 ]
         */
        u8(options) {
          return uIntBcsType({
            readMethod: "read8",
            writeMethod: "write8",
            size: 1,
            maxValue: 2 ** 8 - 1,
            ...options,
            name: options?.name ?? "u8"
          });
        },
        /**
         * Creates a BcsType that can be used to read and write a 16-bit unsigned integer.
         * @example
         * bcs.u16().serialize(65535).toBytes() // Uint8Array [ 255, 255 ]
         */
        u16(options) {
          return uIntBcsType({
            readMethod: "read16",
            writeMethod: "write16",
            size: 2,
            maxValue: 2 ** 16 - 1,
            ...options,
            name: options?.name ?? "u16"
          });
        },
        /**
         * Creates a BcsType that can be used to read and write a 32-bit unsigned integer.
         * @example
         * bcs.u32().serialize(4294967295).toBytes() // Uint8Array [ 255, 255, 255, 255 ]
         */
        u32(options) {
          return uIntBcsType({
            readMethod: "read32",
            writeMethod: "write32",
            size: 4,
            maxValue: 2 ** 32 - 1,
            ...options,
            name: options?.name ?? "u32"
          });
        },
        /**
         * Creates a BcsType that can be used to read and write a 64-bit unsigned integer.
         * @example
         * bcs.u64().serialize(1).toBytes() // Uint8Array [ 1, 0, 0, 0, 0, 0, 0, 0 ]
         */
        u64(options) {
          return bigUIntBcsType({
            readMethod: "read64",
            writeMethod: "write64",
            size: 8,
            maxValue: 2n ** 64n - 1n,
            ...options,
            name: options?.name ?? "u64"
          });
        },
        /**
         * Creates a BcsType that can be used to read and write a 128-bit unsigned integer.
         * @example
         * bcs.u128().serialize(1).toBytes() // Uint8Array [ 1, ..., 0 ]
         */
        u128(options) {
          return bigUIntBcsType({
            readMethod: "read128",
            writeMethod: "write128",
            size: 16,
            maxValue: 2n ** 128n - 1n,
            ...options,
            name: options?.name ?? "u128"
          });
        },
        /**
         * Creates a BcsType that can be used to read and write a 256-bit unsigned integer.
         * @example
         * bcs.u256().serialize(1).toBytes() // Uint8Array [ 1, ..., 0 ]
         */
        u256(options) {
          return bigUIntBcsType({
            readMethod: "read256",
            writeMethod: "write256",
            size: 32,
            maxValue: 2n ** 256n - 1n,
            ...options,
            name: options?.name ?? "u256"
          });
        },
        /**
         * Creates a BcsType that can be used to read and write boolean values.
         * @example
         * bcs.bool().serialize(true).toBytes() // Uint8Array [ 1 ]
         */
        bool(options) {
          return fixedSizeBcsType({
            size: 1,
            read: (reader) => reader.read8() === 1,
            write: (value, writer) => writer.write8(value ? 1 : 0),
            ...options,
            name: options?.name ?? "bool",
            validate: (value) => {
              options?.validate?.(value);
              if (typeof value !== "boolean") {
                throw new TypeError(`Expected boolean, found ${typeof value}`);
              }
            }
          });
        },
        /**
         * Creates a BcsType that can be used to read and write unsigned LEB encoded integers
         * @example
         *
         */
        uleb128(options) {
          return dynamicSizeBcsType({
            read: (reader) => reader.readULEB(),
            serialize: (value) => {
              return Uint8Array.from(ulebEncode(value));
            },
            ...options,
            name: options?.name ?? "uleb128"
          });
        },
        /**
         * Creates a BcsType representing a fixed length byte array
         * @param size The number of bytes this types represents
         * @example
         * bcs.bytes(3).serialize(new Uint8Array([1, 2, 3])).toBytes() // Uint8Array [1, 2, 3]
         */
        bytes(size, options) {
          return fixedSizeBcsType({
            size,
            read: (reader) => reader.readBytes(size),
            write: (value, writer) => {
              const array = new Uint8Array(value);
              for (let i = 0; i < size; i++) {
                writer.write8(array[i] ?? 0);
              }
            },
            ...options,
            name: options?.name ?? `bytes[${size}]`,
            validate: (value) => {
              options?.validate?.(value);
              if (!value || typeof value !== "object" || !("length" in value)) {
                throw new TypeError(`Expected array, found ${typeof value}`);
              }
              if (value.length !== size) {
                throw new TypeError(`Expected array of length ${size}, found ${value.length}`);
              }
            }
          });
        },
        /**
         * Creates a BcsType representing a variable length byte array
         *
         * @example
         * bcs.byteVector().serialize([1, 2, 3]).toBytes() // Uint8Array [3, 1, 2, 3]
         */
        byteVector(options) {
          return new BcsType({
            read: (reader) => {
              const length = reader.readULEB();
              return reader.readBytes(length);
            },
            write: (value, writer) => {
              const array = new Uint8Array(value);
              writer.writeULEB(array.length);
              for (let i = 0; i < array.length; i++) {
                writer.write8(array[i] ?? 0);
              }
            },
            ...options,
            name: options?.name ?? "vector<u8>",
            serializedSize: (value) => {
              const length = "length" in value ? value.length : null;
              return length == null ? null : ulebEncode(length).length + length;
            },
            validate: (value) => {
              options?.validate?.(value);
              if (!value || typeof value !== "object" || !("length" in value)) {
                throw new TypeError(`Expected array, found ${typeof value}`);
              }
            }
          });
        },
        /**
         * Creates a BcsType that can ser/de string values.  Strings will be UTF-8 encoded
         * @example
         * bcs.string().serialize('a').toBytes() // Uint8Array [ 1, 97 ]
         */
        string(options) {
          return stringLikeBcsType({
            toBytes: (value) => new TextEncoder().encode(value),
            fromBytes: (bytes) => new TextDecoder().decode(bytes),
            ...options,
            name: options?.name ?? "string"
          });
        },
        /**
         * Creates a BcsType that represents a fixed length array of a given type
         * @param size The number of elements in the array
         * @param type The BcsType of each element in the array
         * @example
         * bcs.fixedArray(3, bcs.u8()).serialize([1, 2, 3]).toBytes() // Uint8Array [ 1, 2, 3 ]
         */
        fixedArray,
        /**
         * Creates a BcsType representing an optional value
         * @param type The BcsType of the optional value
         * @example
         * bcs.option(bcs.u8()).serialize(null).toBytes() // Uint8Array [ 0 ]
         * bcs.option(bcs.u8()).serialize(1).toBytes() // Uint8Array [ 1, 1 ]
         */
        option,
        /**
         * Creates a BcsType representing a variable length vector of a given type
         * @param type The BcsType of each element in the vector
         *
         * @example
         * bcs.vector(bcs.u8()).toBytes([1, 2, 3]) // Uint8Array [ 3, 1, 2, 3 ]
         */
        vector,
        /**
         * Creates a BcsType representing a tuple of a given set of types
         * @param types The BcsTypes for each element in the tuple
         *
         * @example
         * const tuple = bcs.tuple([bcs.u8(), bcs.string(), bcs.bool()])
         * tuple.serialize([1, 'a', true]).toBytes() // Uint8Array [ 1, 1, 97, 1 ]
         */
        tuple(fields, options) {
          return new BcsTuple({
            fields,
            ...options
          });
        },
        /**
         * Creates a BcsType representing a struct of a given set of fields
         * @param name The name of the struct
         * @param fields The fields of the struct. The order of the fields affects how data is serialized and deserialized
         *
         * @example
         * const struct = bcs.struct('MyStruct', {
         *  a: bcs.u8(),
         *  b: bcs.string(),
         * })
         * struct.serialize({ a: 1, b: 'a' }).toBytes() // Uint8Array [ 1, 1, 97 ]
         */
        struct(name, fields, options) {
          return new BcsStruct({
            name,
            fields,
            ...options
          });
        },
        /**
         * Creates a BcsType representing an enum of a given set of options
         * @param name The name of the enum
         * @param values The values of the enum. The order of the values affects how data is serialized and deserialized.
         * null can be used to represent a variant with no data.
         *
         * @example
         * const enum = bcs.enum('MyEnum', {
         *   A: bcs.u8(),
         *   B: bcs.string(),
         *   C: null,
         * })
         * enum.serialize({ A: 1 }).toBytes() // Uint8Array [ 0, 1 ]
         * enum.serialize({ B: 'a' }).toBytes() // Uint8Array [ 1, 1, 97 ]
         * enum.serialize({ C: true }).toBytes() // Uint8Array [ 2 ]
         */
        enum(name, fields, options) {
          return new BcsEnum({
            name,
            fields,
            ...options
          });
        },
        /**
         * Creates a BcsType representing a map of a given key and value type
         * @param keyType The BcsType of the key
         * @param valueType The BcsType of the value
         * @example
         * const map = bcs.map(bcs.u8(), bcs.string())
         * map.serialize(new Map([[2, 'a']])).toBytes() // Uint8Array [ 1, 2, 1, 97 ]
         */
        map,
        /**
         * Creates a BcsType that wraps another BcsType which is lazily evaluated. This is useful for creating recursive types.
         * @param cb A callback that returns the BcsType
         */
        lazy(cb) {
          return lazyBcsType(cb);
        }
      };

      const toB64 = exports("toB64", toBase64);
      const fromB64 = exports("fromB64", fromBase64);
      const toHEX = exports("toHEX", toHex);
      const fromHEX = exports("fromHEX", fromHex);

      var __typeError$8 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$8 = (obj, member, msg) => member.has(obj) || __typeError$8("Cannot " + msg);
      var __privateGet$8 = (obj, member, getter) => (__accessCheck$8(obj, member, "read from private field"), member.get(obj));
      var __privateAdd$8 = (obj, member, value) => member.has(obj) ? __typeError$8("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$7 = (obj, member, value, setter) => (__accessCheck$8(obj, member, "write to private field"), member.set(obj, value), value);
      var _prefix, _cache$4;
      const _ClientCache = class _ClientCache {
        constructor({ prefix, cache } = {}) {
          __privateAdd$8(this, _prefix);
          __privateAdd$8(this, _cache$4);
          __privateSet$7(this, _prefix, prefix ?? []);
          __privateSet$7(this, _cache$4, cache ?? /* @__PURE__ */ new Map());
        }
        read(key, load) {
          const cacheKey = [__privateGet$8(this, _prefix), ...key].join(":");
          if (__privateGet$8(this, _cache$4).has(cacheKey)) {
            return __privateGet$8(this, _cache$4).get(cacheKey);
          }
          const result = load();
          __privateGet$8(this, _cache$4).set(cacheKey, result);
          if (typeof result === "object" && result !== null && "then" in result) {
            return Promise.resolve(result).then((v) => {
              __privateGet$8(this, _cache$4).set(cacheKey, v);
              return v;
            }).catch((err) => {
              __privateGet$8(this, _cache$4).delete(cacheKey);
              throw err;
            });
          }
          return result;
        }
        readSync(key, load) {
          const cacheKey = [__privateGet$8(this, _prefix), ...key].join(":");
          if (__privateGet$8(this, _cache$4).has(cacheKey)) {
            return __privateGet$8(this, _cache$4).get(cacheKey);
          }
          const result = load();
          __privateGet$8(this, _cache$4).set(cacheKey, result);
          return result;
        }
        clear(prefix) {
          const prefixKey = [...__privateGet$8(this, _prefix), ...prefix ?? []].join(":");
          if (!prefixKey) {
            __privateGet$8(this, _cache$4).clear();
            return;
          }
          for (const key of __privateGet$8(this, _cache$4).keys()) {
            if (key.startsWith(prefixKey)) {
              __privateGet$8(this, _cache$4).delete(key);
            }
          }
        }
        scope(prefix) {
          return new _ClientCache({
            prefix: [...__privateGet$8(this, _prefix), ...Array.isArray(prefix) ? prefix : [prefix]],
            cache: __privateGet$8(this, _cache$4)
          });
        }
      };
      _prefix = new WeakMap();
      _cache$4 = new WeakMap();
      let ClientCache = _ClientCache;

      class Experimental_BaseClient {
        constructor({
          network,
          base,
          cache = base?.cache ?? new ClientCache()
        }) {
          this.network = network;
          this.base = base ?? this;
          this.cache = cache;
        }
        $extend(...registrations) {
          return Object.create(
            this,
            Object.fromEntries(
              registrations.map((registration) => {
                if ("experimental_asClientExtension" in registration) {
                  const { name, register } = registration.experimental_asClientExtension();
                  return [name, { value: register(this) }];
                }
                return [registration.name, { value: registration.register(this) }];
              })
            )
          );
        }
      }

      // src/actions/await/awaitAsync.ts

      // src/storages/globalConfig/globalConfig.ts
      var store;
      function getGlobalConfig(config2) {
        return {
          lang: config2?.lang ?? store?.lang,
          message: config2?.message,
          abortEarly: config2?.abortEarly ?? store?.abortEarly,
          abortPipeEarly: config2?.abortPipeEarly ?? store?.abortPipeEarly
        };
      }

      // src/storages/globalMessage/globalMessage.ts
      var store2;
      function getGlobalMessage(lang) {
        return store2?.get(lang);
      }

      // src/storages/schemaMessage/schemaMessage.ts
      var store3;
      function getSchemaMessage(lang) {
        return store3?.get(lang);
      }

      // src/storages/specificMessage/specificMessage.ts
      var store4;
      function getSpecificMessage(reference, lang) {
        return store4?.get(reference)?.get(lang);
      }

      // src/utils/_stringify/_stringify.ts
      function _stringify(input) {
        const type = typeof input;
        if (type === "string") {
          return `"${input}"`;
        }
        if (type === "number" || type === "bigint" || type === "boolean") {
          return `${input}`;
        }
        if (type === "object" || type === "function") {
          return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
        }
        return type;
      }

      // src/utils/_addIssue/_addIssue.ts
      function _addIssue(context, label, dataset, config2, other) {
        const input = other && "input" in other ? other.input : dataset.value;
        const expected = other?.expected ?? context.expects ?? null;
        const received = other?.received ?? _stringify(input);
        const issue = {
          kind: context.kind,
          type: context.type,
          input,
          expected,
          received,
          message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
          // @ts-expect-error
          requirement: context.requirement,
          path: other?.path,
          issues: other?.issues,
          lang: config2.lang,
          abortEarly: config2.abortEarly,
          abortPipeEarly: config2.abortPipeEarly
        };
        const isSchema = context.kind === "schema";
        const message = other?.message ?? // @ts-expect-error
        context.message ?? getSpecificMessage(context.reference, issue.lang) ?? (isSchema ? getSchemaMessage(issue.lang) : null) ?? config2.message ?? getGlobalMessage(issue.lang);
        if (message) {
          issue.message = typeof message === "function" ? message(issue) : message;
        }
        if (isSchema) {
          dataset.typed = false;
        }
        if (dataset.issues) {
          dataset.issues.push(issue);
        } else {
          dataset.issues = [issue];
        }
      }

      // src/utils/_isValidObjectKey/_isValidObjectKey.ts
      function _isValidObjectKey(object2, key) {
        return Object.hasOwn(object2, key) && key !== "__proto__" && key !== "prototype" && key !== "constructor";
      }

      // src/utils/ValiError/ValiError.ts
      var ValiError = class extends Error {
        /**
         * The error issues.
         */
        issues;
        /**
         * Creates a Valibot error with useful information.
         *
         * @param issues The error issues.
         */
        constructor(issues) {
          super(issues[0].message);
          this.name = "ValiError";
          this.issues = issues;
        }
      };

      // src/actions/check/check.ts
      function check(requirement, message) {
        return {
          kind: "validation",
          type: "check",
          reference: check,
          async: false,
          expects: null,
          requirement,
          message,
          _run(dataset, config2) {
            if (dataset.typed && !this.requirement(dataset.value)) {
              _addIssue(this, "input", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/actions/integer/integer.ts
      function integer(message) {
        return {
          kind: "validation",
          type: "integer",
          reference: integer,
          async: false,
          expects: null,
          requirement: Number.isInteger,
          message,
          _run(dataset, config2) {
            if (dataset.typed && !this.requirement(dataset.value)) {
              _addIssue(this, "integer", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/actions/transform/transform.ts
      function transform(operation) {
        return {
          kind: "transformation",
          type: "transform",
          reference: transform,
          async: false,
          operation,
          _run(dataset) {
            dataset.value = this.operation(dataset.value);
            return dataset;
          }
        };
      }

      // src/methods/getDefault/getDefault.ts
      function getDefault(schema, dataset, config2) {
        return typeof schema.default === "function" ? (
          // @ts-expect-error
          schema.default(dataset, config2)
        ) : (
          // @ts-expect-error
          schema.default
        );
      }

      // src/methods/is/is.ts
      function is(schema, input) {
        return !schema._run({ typed: false, value: input }, { abortEarly: true }).issues;
      }

      // src/schemas/array/array.ts
      function array(item, message) {
        return {
          kind: "schema",
          type: "array",
          reference: array,
          expects: "Array",
          async: false,
          item,
          message,
          _run(dataset, config2) {
            const input = dataset.value;
            if (Array.isArray(input)) {
              dataset.typed = true;
              dataset.value = [];
              for (let key = 0; key < input.length; key++) {
                const value2 = input[key];
                const itemDataset = this.item._run({ typed: false, value: value2 }, config2);
                if (itemDataset.issues) {
                  const pathItem = {
                    type: "array",
                    origin: "value",
                    input,
                    key,
                    value: value2
                  };
                  for (const issue of itemDataset.issues) {
                    if (issue.path) {
                      issue.path.unshift(pathItem);
                    } else {
                      issue.path = [pathItem];
                    }
                    dataset.issues?.push(issue);
                  }
                  if (!dataset.issues) {
                    dataset.issues = itemDataset.issues;
                  }
                  if (config2.abortEarly) {
                    dataset.typed = false;
                    break;
                  }
                }
                if (!itemDataset.typed) {
                  dataset.typed = false;
                }
                dataset.value.push(itemDataset.value);
              }
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/bigint/bigint.ts
      function bigint(message) {
        return {
          kind: "schema",
          type: "bigint",
          reference: bigint,
          expects: "bigint",
          async: false,
          message,
          _run(dataset, config2) {
            if (typeof dataset.value === "bigint") {
              dataset.typed = true;
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/boolean/boolean.ts
      function boolean(message) {
        return {
          kind: "schema",
          type: "boolean",
          reference: boolean,
          expects: "boolean",
          async: false,
          message,
          _run(dataset, config2) {
            if (typeof dataset.value === "boolean") {
              dataset.typed = true;
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/lazy/lazy.ts
      function lazy(getter) {
        return {
          kind: "schema",
          type: "lazy",
          reference: lazy,
          expects: "unknown",
          async: false,
          getter,
          _run(dataset, config2) {
            return this.getter(dataset.value)._run(dataset, config2);
          }
        };
      }

      // src/schemas/literal/literal.ts
      function literal(literal_, message) {
        return {
          kind: "schema",
          type: "literal",
          reference: literal,
          expects: _stringify(literal_),
          async: false,
          literal: literal_,
          message,
          _run(dataset, config2) {
            if (dataset.value === this.literal) {
              dataset.typed = true;
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/nullable/nullable.ts
      function nullable(wrapped, ...args) {
        const schema = {
          kind: "schema",
          type: "nullable",
          reference: nullable,
          expects: `${wrapped.expects} | null`,
          async: false,
          wrapped,
          _run(dataset, config2) {
            if (dataset.value === null) {
              if ("default" in this) {
                dataset.value = getDefault(
                  this,
                  dataset,
                  config2
                );
              }
              if (dataset.value === null) {
                dataset.typed = true;
                return dataset;
              }
            }
            return this.wrapped._run(dataset, config2);
          }
        };
        if (0 in args) {
          schema.default = args[0];
        }
        return schema;
      }

      // src/schemas/nullish/nullish.ts
      function nullish(wrapped, ...args) {
        const schema = {
          kind: "schema",
          type: "nullish",
          reference: nullish,
          expects: `${wrapped.expects} | null | undefined`,
          async: false,
          wrapped,
          _run(dataset, config2) {
            if (dataset.value === null || dataset.value === void 0) {
              if ("default" in this) {
                dataset.value = getDefault(
                  this,
                  dataset,
                  config2
                );
              }
              if (dataset.value === null || dataset.value === void 0) {
                dataset.typed = true;
                return dataset;
              }
            }
            return this.wrapped._run(dataset, config2);
          }
        };
        if (0 in args) {
          schema.default = args[0];
        }
        return schema;
      }

      // src/schemas/number/number.ts
      function number(message) {
        return {
          kind: "schema",
          type: "number",
          reference: number,
          expects: "number",
          async: false,
          message,
          _run(dataset, config2) {
            if (typeof dataset.value === "number" && !isNaN(dataset.value)) {
              dataset.typed = true;
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/object/object.ts
      function object(entries, message) {
        return {
          kind: "schema",
          type: "object",
          reference: object,
          expects: "Object",
          async: false,
          entries,
          message,
          _run(dataset, config2) {
            const input = dataset.value;
            if (input && typeof input === "object") {
              dataset.typed = true;
              dataset.value = {};
              for (const key in this.entries) {
                const value2 = input[key];
                const valueDataset = this.entries[key]._run(
                  { typed: false, value: value2 },
                  config2
                );
                if (valueDataset.issues) {
                  const pathItem = {
                    type: "object",
                    origin: "value",
                    input,
                    key,
                    value: value2
                  };
                  for (const issue of valueDataset.issues) {
                    if (issue.path) {
                      issue.path.unshift(pathItem);
                    } else {
                      issue.path = [pathItem];
                    }
                    dataset.issues?.push(issue);
                  }
                  if (!dataset.issues) {
                    dataset.issues = valueDataset.issues;
                  }
                  if (config2.abortEarly) {
                    dataset.typed = false;
                    break;
                  }
                }
                if (!valueDataset.typed) {
                  dataset.typed = false;
                }
                if (valueDataset.value !== void 0 || key in input) {
                  dataset.value[key] = valueDataset.value;
                }
              }
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/optional/optional.ts
      function optional(wrapped, ...args) {
        const schema = {
          kind: "schema",
          type: "optional",
          reference: optional,
          expects: `${wrapped.expects} | undefined`,
          async: false,
          wrapped,
          _run(dataset, config2) {
            if (dataset.value === void 0) {
              if ("default" in this) {
                dataset.value = getDefault(
                  this,
                  dataset,
                  config2
                );
              }
              if (dataset.value === void 0) {
                dataset.typed = true;
                return dataset;
              }
            }
            return this.wrapped._run(dataset, config2);
          }
        };
        if (0 in args) {
          schema.default = args[0];
        }
        return schema;
      }

      // src/schemas/record/record.ts
      function record(key, value2, message) {
        return {
          kind: "schema",
          type: "record",
          reference: record,
          expects: "Object",
          async: false,
          key,
          value: value2,
          message,
          _run(dataset, config2) {
            const input = dataset.value;
            if (input && typeof input === "object") {
              dataset.typed = true;
              dataset.value = {};
              for (const entryKey in input) {
                if (_isValidObjectKey(input, entryKey)) {
                  const entryValue = input[entryKey];
                  const keyDataset = this.key._run(
                    { typed: false, value: entryKey },
                    config2
                  );
                  if (keyDataset.issues) {
                    const pathItem = {
                      type: "object",
                      origin: "key",
                      input,
                      key: entryKey,
                      value: entryValue
                    };
                    for (const issue of keyDataset.issues) {
                      issue.path = [pathItem];
                      dataset.issues?.push(issue);
                    }
                    if (!dataset.issues) {
                      dataset.issues = keyDataset.issues;
                    }
                    if (config2.abortEarly) {
                      dataset.typed = false;
                      break;
                    }
                  }
                  const valueDataset = this.value._run(
                    { typed: false, value: entryValue },
                    config2
                  );
                  if (valueDataset.issues) {
                    const pathItem = {
                      type: "object",
                      origin: "value",
                      input,
                      key: entryKey,
                      value: entryValue
                    };
                    for (const issue of valueDataset.issues) {
                      if (issue.path) {
                        issue.path.unshift(pathItem);
                      } else {
                        issue.path = [pathItem];
                      }
                      dataset.issues?.push(issue);
                    }
                    if (!dataset.issues) {
                      dataset.issues = valueDataset.issues;
                    }
                    if (config2.abortEarly) {
                      dataset.typed = false;
                      break;
                    }
                  }
                  if (!keyDataset.typed || !valueDataset.typed) {
                    dataset.typed = false;
                  }
                  if (keyDataset.typed) {
                    dataset.value[keyDataset.value] = valueDataset.value;
                  }
                }
              }
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/string/string.ts
      function string(message) {
        return {
          kind: "schema",
          type: "string",
          reference: string,
          expects: "string",
          async: false,
          message,
          _run(dataset, config2) {
            if (typeof dataset.value === "string") {
              dataset.typed = true;
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/tuple/tuple.ts
      function tuple(items, message) {
        return {
          kind: "schema",
          type: "tuple",
          reference: tuple,
          expects: "Array",
          async: false,
          items,
          message,
          _run(dataset, config2) {
            const input = dataset.value;
            if (Array.isArray(input)) {
              dataset.typed = true;
              dataset.value = [];
              for (let key = 0; key < this.items.length; key++) {
                const value2 = input[key];
                const itemDataset = this.items[key]._run(
                  { typed: false, value: value2 },
                  config2
                );
                if (itemDataset.issues) {
                  const pathItem = {
                    type: "array",
                    origin: "value",
                    input,
                    key,
                    value: value2
                  };
                  for (const issue of itemDataset.issues) {
                    if (issue.path) {
                      issue.path.unshift(pathItem);
                    } else {
                      issue.path = [pathItem];
                    }
                    dataset.issues?.push(issue);
                  }
                  if (!dataset.issues) {
                    dataset.issues = itemDataset.issues;
                  }
                  if (config2.abortEarly) {
                    dataset.typed = false;
                    break;
                  }
                }
                if (!itemDataset.typed) {
                  dataset.typed = false;
                }
                dataset.value.push(itemDataset.value);
              }
            } else {
              _addIssue(this, "type", dataset, config2);
            }
            return dataset;
          }
        };
      }

      // src/schemas/union/utils/_subIssues/_subIssues.ts
      function _subIssues(datasets) {
        let issues;
        if (datasets) {
          for (const dataset of datasets) {
            if (issues) {
              issues.push(...dataset.issues);
            } else {
              issues = dataset.issues;
            }
          }
        }
        return issues;
      }

      // src/schemas/union/union.ts
      function union(options, message) {
        return {
          kind: "schema",
          type: "union",
          reference: union,
          expects: [...new Set(options.map((option) => option.expects))].join(" | ") || "never",
          async: false,
          options,
          message,
          _run(dataset, config2) {
            let validDataset;
            let typedDatasets;
            let untypedDatasets;
            for (const schema of this.options) {
              const optionDataset = schema._run(
                { typed: false, value: dataset.value },
                config2
              );
              if (optionDataset.typed) {
                if (optionDataset.issues) {
                  if (typedDatasets) {
                    typedDatasets.push(optionDataset);
                  } else {
                    typedDatasets = [optionDataset];
                  }
                } else {
                  validDataset = optionDataset;
                  break;
                }
              } else {
                if (untypedDatasets) {
                  untypedDatasets.push(optionDataset);
                } else {
                  untypedDatasets = [optionDataset];
                }
              }
            }
            if (validDataset) {
              return validDataset;
            }
            if (typedDatasets) {
              if (typedDatasets.length === 1) {
                return typedDatasets[0];
              }
              _addIssue(this, "type", dataset, config2, {
                issues: _subIssues(typedDatasets)
              });
              dataset.typed = true;
            } else if (untypedDatasets?.length === 1) {
              return untypedDatasets[0];
            } else {
              _addIssue(this, "type", dataset, config2, {
                issues: _subIssues(untypedDatasets)
              });
            }
            return dataset;
          }
        };
      }

      // src/schemas/unknown/unknown.ts
      function unknown() {
        return {
          kind: "schema",
          type: "unknown",
          reference: unknown,
          expects: "unknown",
          async: false,
          _run(dataset) {
            dataset.typed = true;
            return dataset;
          }
        };
      }

      // src/methods/parse/parse.ts
      function parse(schema, input, config2) {
        const dataset = schema._run(
          { typed: false, value: input },
          getGlobalConfig(config2)
        );
        if (dataset.issues) {
          throw new ValiError(dataset.issues);
        }
        return dataset.value;
      }

      // src/methods/pipe/pipe.ts
      function pipe(...pipe2) {
        return {
          ...pipe2[0],
          pipe: pipe2,
          _run(dataset, config2) {
            for (let index = 0; index < pipe2.length; index++) {
              if (dataset.issues && (pipe2[index].kind === "schema" || pipe2[index].kind === "transformation")) {
                dataset.typed = false;
                break;
              }
              if (!dataset.issues || !config2.abortEarly && !config2.abortPipeEarly) {
                dataset = pipe2[index]._run(dataset, config2);
              }
            }
            return dataset;
          }
        };
      }

      const SUI_NS_NAME_REGEX = /^(?!.*(^(?!@)|[-.@])($|[-.@]))(?:[a-z0-9-]{0,63}(?:\.[a-z0-9-]{0,63})*)?@[a-z0-9-]{0,63}$/i;
      const SUI_NS_DOMAIN_REGEX = /^(?!.*(^|[-.])($|[-.]))(?:[a-z0-9-]{0,63}\.)+sui$/i;
      const MAX_SUI_NS_NAME_LENGTH = 235;
      function isValidSuiNSName(name) {
        if (name.length > MAX_SUI_NS_NAME_LENGTH) {
          return false;
        }
        if (name.includes("@")) {
          return SUI_NS_NAME_REGEX.test(name);
        }
        return SUI_NS_DOMAIN_REGEX.test(name);
      }
      function normalizeSuiNSName(name, format = "at") {
        const lowerCase = name.toLowerCase();
        let parts;
        if (lowerCase.includes("@")) {
          if (!SUI_NS_NAME_REGEX.test(lowerCase)) {
            throw new Error(`Invalid SuiNS name ${name}`);
          }
          const [labels, domain] = lowerCase.split("@");
          parts = [...labels ? labels.split(".") : [], domain];
        } else {
          if (!SUI_NS_DOMAIN_REGEX.test(lowerCase)) {
            throw new Error(`Invalid SuiNS name ${name}`);
          }
          parts = lowerCase.split(".").slice(0, -1);
        }
        if (format === "dot") {
          return `${parts.join(".")}.sui`;
        }
        return `${parts.slice(0, -1).join(".")}@${parts[parts.length - 1]}`;
      }

      const NAME_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)$/;
      const VERSION_REGEX = /^\d+$/;
      const MAX_APP_SIZE = 64;
      const NAME_SEPARATOR$1 = "/";
      const isValidNamedPackage = exports("isValidNamedPackage", (name) => {
        const parts = name.split(NAME_SEPARATOR$1);
        if (parts.length < 2 || parts.length > 3) return false;
        const [org, app, version] = parts;
        if (version !== void 0 && !VERSION_REGEX.test(version)) return false;
        if (!isValidSuiNSName(org)) return false;
        return NAME_PATTERN.test(app) && app.length < MAX_APP_SIZE;
      });
      const isValidNamedType = exports("isValidNamedType", (type) => {
        const splitType = type.split(/::|<|>|,/);
        for (const t of splitType) {
          if (t.includes(NAME_SEPARATOR$1) && !isValidNamedPackage(t)) return false;
        }
        return true;
      });

      const TX_DIGEST_LENGTH = 32;
      function isValidTransactionDigest(value) {
        try {
          const buffer = fromBase58(value);
          return buffer.length === TX_DIGEST_LENGTH;
        } catch {
          return false;
        }
      }
      const SUI_ADDRESS_LENGTH = exports("SUI_ADDRESS_LENGTH", 32);
      function isValidSuiAddress(value) {
        return isHex(value) && getHexByteLength(value) === SUI_ADDRESS_LENGTH;
      }
      function isValidSuiObjectId(value) {
        return isValidSuiAddress(value);
      }
      function parseTypeTag(type) {
        if (!type.includes("::")) return type;
        return parseStructTag(type);
      }
      function parseStructTag(type) {
        const [address, module] = type.split("::");
        const isMvrPackage = isValidNamedPackage(address);
        const rest = type.slice(address.length + module.length + 4);
        const name = rest.includes("<") ? rest.slice(0, rest.indexOf("<")) : rest;
        const typeParams = rest.includes("<") ? splitGenericParameters(rest.slice(rest.indexOf("<") + 1, rest.lastIndexOf(">"))).map(
          (typeParam) => parseTypeTag(typeParam.trim())
        ) : [];
        return {
          address: isMvrPackage ? address : normalizeSuiAddress(address),
          module,
          name,
          typeParams
        };
      }
      function normalizeStructTag(type) {
        const { address, module, name, typeParams } = typeof type === "string" ? parseStructTag(type) : type;
        const formattedTypeParams = typeParams?.length > 0 ? `<${typeParams.map(
    (typeParam) => typeof typeParam === "string" ? typeParam : normalizeStructTag(typeParam)
  ).join(",")}>` : "";
        return `${address}::${module}::${name}${formattedTypeParams}`;
      }
      function normalizeSuiAddress(value, forceAdd0x = false) {
        let address = value.toLowerCase();
        if (!forceAdd0x && address.startsWith("0x")) {
          address = address.slice(2);
        }
        return `0x${address.padStart(SUI_ADDRESS_LENGTH * 2, "0")}`;
      }
      function normalizeSuiObjectId(value, forceAdd0x = false) {
        return normalizeSuiAddress(value, forceAdd0x);
      }
      function isHex(value) {
        return /^(0x|0X)?[a-fA-F0-9]+$/.test(value) && value.length % 2 === 0;
      }
      function getHexByteLength(value) {
        return /^(0x|0X)/.test(value) ? (value.length - 2) / 2 : value.length / 2;
      }

      function safeEnum(options) {
        const unionOptions = Object.entries(options).map(([key, value]) => object({ [key]: value }));
        return pipe(
          union(unionOptions),
          transform((value) => ({
            ...value,
            $kind: Object.keys(value)[0]
          }))
        );
      }
      const SuiAddress = pipe(
        string(),
        transform((value) => normalizeSuiAddress(value)),
        check(isValidSuiAddress)
      );
      const ObjectID = SuiAddress;
      const BCSBytes = string();
      const JsonU64 = pipe(
        union([string(), pipe(number(), integer())]),
        check((val) => {
          try {
            BigInt(val);
            return BigInt(val) >= 0 && BigInt(val) <= 18446744073709551615n;
          } catch {
            return false;
          }
        }, "Invalid u64")
      );
      const ObjectRefSchema = object({
        objectId: SuiAddress,
        version: JsonU64,
        digest: string()
      });
      const ArgumentSchema = pipe(
        union([
          object({ GasCoin: literal(true) }),
          object({ Input: pipe(number(), integer()), type: optional(literal("pure")) }),
          object({ Input: pipe(number(), integer()), type: optional(literal("object")) }),
          object({ Result: pipe(number(), integer()) }),
          object({ NestedResult: tuple([pipe(number(), integer()), pipe(number(), integer())]) })
        ]),
        transform((value) => ({
          ...value,
          $kind: Object.keys(value)[0]
        }))
        // Defined manually to add `type?: 'pure' | 'object'` to Input
      );
      const GasDataSchema = object({
        budget: nullable(JsonU64),
        price: nullable(JsonU64),
        owner: nullable(SuiAddress),
        payment: nullable(array(ObjectRefSchema))
      });
      const OpenMoveTypeSignatureBodySchema = union([
        literal("address"),
        literal("bool"),
        literal("u8"),
        literal("u16"),
        literal("u32"),
        literal("u64"),
        literal("u128"),
        literal("u256"),
        object({ vector: lazy(() => OpenMoveTypeSignatureBodySchema) }),
        object({
          datatype: object({
            package: string(),
            module: string(),
            type: string(),
            typeParameters: array(lazy(() => OpenMoveTypeSignatureBodySchema))
          })
        }),
        object({ typeParameter: pipe(number(), integer()) })
      ]);
      const OpenMoveTypeSignatureSchema = object({
        ref: nullable(union([literal("&"), literal("&mut")])),
        body: OpenMoveTypeSignatureBodySchema
      });
      const ProgrammableMoveCallSchema = object({
        package: ObjectID,
        module: string(),
        function: string(),
        // snake case in rust
        typeArguments: array(string()),
        arguments: array(ArgumentSchema),
        _argumentTypes: optional(nullable(array(OpenMoveTypeSignatureSchema)))
      });
      const $Intent$1 = object({
        name: string(),
        inputs: record(string(), union([ArgumentSchema, array(ArgumentSchema)])),
        data: record(string(), unknown())
      });
      const CommandSchema = safeEnum({
        MoveCall: ProgrammableMoveCallSchema,
        TransferObjects: object({
          objects: array(ArgumentSchema),
          address: ArgumentSchema
        }),
        SplitCoins: object({
          coin: ArgumentSchema,
          amounts: array(ArgumentSchema)
        }),
        MergeCoins: object({
          destination: ArgumentSchema,
          sources: array(ArgumentSchema)
        }),
        Publish: object({
          modules: array(BCSBytes),
          dependencies: array(ObjectID)
        }),
        MakeMoveVec: object({
          type: nullable(string()),
          elements: array(ArgumentSchema)
        }),
        Upgrade: object({
          modules: array(BCSBytes),
          dependencies: array(ObjectID),
          package: ObjectID,
          ticket: ArgumentSchema
        }),
        $Intent: $Intent$1
      });
      const ObjectArgSchema = safeEnum({
        ImmOrOwnedObject: ObjectRefSchema,
        SharedObject: object({
          objectId: ObjectID,
          // snake case in rust
          initialSharedVersion: JsonU64,
          mutable: boolean()
        }),
        Receiving: ObjectRefSchema
      });
      const CallArgSchema = safeEnum({
        Object: ObjectArgSchema,
        Pure: object({
          bytes: BCSBytes
        }),
        UnresolvedPure: object({
          value: unknown()
        }),
        UnresolvedObject: object({
          objectId: ObjectID,
          version: optional(nullable(JsonU64)),
          digest: optional(nullable(string())),
          initialSharedVersion: optional(nullable(JsonU64)),
          mutable: optional(nullable(boolean()))
        })
      });
      const NormalizedCallArg$1 = safeEnum({
        Object: ObjectArgSchema,
        Pure: object({
          bytes: BCSBytes
        })
      });
      const TransactionExpiration$3 = safeEnum({
        None: literal(true),
        Epoch: JsonU64
      });
      const TransactionDataSchema = object({
        version: literal(2),
        sender: nullish(SuiAddress),
        expiration: nullish(TransactionExpiration$3),
        gasData: GasDataSchema,
        inputs: array(CallArgSchema),
        commands: array(CommandSchema)
      });

      var UpgradePolicy = exports("UpgradePolicy", /* @__PURE__ */ ((UpgradePolicy2) => {
        UpgradePolicy2[UpgradePolicy2["COMPATIBLE"] = 0] = "COMPATIBLE";
        UpgradePolicy2[UpgradePolicy2["ADDITIVE"] = 128] = "ADDITIVE";
        UpgradePolicy2[UpgradePolicy2["DEP_ONLY"] = 192] = "DEP_ONLY";
        return UpgradePolicy2;
      })(UpgradePolicy || {}));
      const Commands = exports("Commands", {
        MoveCall(input) {
          const [pkg, mod = "", fn = ""] = "target" in input ? input.target.split("::") : [input.package, input.module, input.function];
          return {
            $kind: "MoveCall",
            MoveCall: {
              package: pkg,
              module: mod,
              function: fn,
              typeArguments: input.typeArguments ?? [],
              arguments: input.arguments ?? []
            }
          };
        },
        TransferObjects(objects, address) {
          return {
            $kind: "TransferObjects",
            TransferObjects: {
              objects: objects.map((o) => parse(ArgumentSchema, o)),
              address: parse(ArgumentSchema, address)
            }
          };
        },
        SplitCoins(coin, amounts) {
          return {
            $kind: "SplitCoins",
            SplitCoins: {
              coin: parse(ArgumentSchema, coin),
              amounts: amounts.map((o) => parse(ArgumentSchema, o))
            }
          };
        },
        MergeCoins(destination, sources) {
          return {
            $kind: "MergeCoins",
            MergeCoins: {
              destination: parse(ArgumentSchema, destination),
              sources: sources.map((o) => parse(ArgumentSchema, o))
            }
          };
        },
        Publish({
          modules,
          dependencies
        }) {
          return {
            $kind: "Publish",
            Publish: {
              modules: modules.map(
                (module) => typeof module === "string" ? module : toBase64(new Uint8Array(module))
              ),
              dependencies: dependencies.map((dep) => normalizeSuiObjectId(dep))
            }
          };
        },
        Upgrade({
          modules,
          dependencies,
          package: packageId,
          ticket
        }) {
          return {
            $kind: "Upgrade",
            Upgrade: {
              modules: modules.map(
                (module) => typeof module === "string" ? module : toBase64(new Uint8Array(module))
              ),
              dependencies: dependencies.map((dep) => normalizeSuiObjectId(dep)),
              package: packageId,
              ticket: parse(ArgumentSchema, ticket)
            }
          };
        },
        MakeMoveVec({
          type,
          elements
        }) {
          return {
            $kind: "MakeMoveVec",
            MakeMoveVec: {
              type: type ?? null,
              elements: elements.map((o) => parse(ArgumentSchema, o))
            }
          };
        },
        Intent({
          name,
          inputs = {},
          data = {}
        }) {
          return {
            $kind: "$Intent",
            $Intent: {
              name,
              inputs: Object.fromEntries(
                Object.entries(inputs).map(([key, value]) => [
                  key,
                  Array.isArray(value) ? value.map((o) => parse(ArgumentSchema, o)) : parse(ArgumentSchema, value)
                ])
              ),
              data
            }
          };
        }
      });

      const VECTOR_REGEX = /^vector<(.+)>$/;
      const STRUCT_REGEX = /^([^:]+)::([^:]+)::([^<]+)(<(.+)>)?/;
      class TypeTagSerializer {
        static parseFromStr(str, normalizeAddress = false) {
          if (str === "address") {
            return { address: null };
          } else if (str === "bool") {
            return { bool: null };
          } else if (str === "u8") {
            return { u8: null };
          } else if (str === "u16") {
            return { u16: null };
          } else if (str === "u32") {
            return { u32: null };
          } else if (str === "u64") {
            return { u64: null };
          } else if (str === "u128") {
            return { u128: null };
          } else if (str === "u256") {
            return { u256: null };
          } else if (str === "signer") {
            return { signer: null };
          }
          const vectorMatch = str.match(VECTOR_REGEX);
          if (vectorMatch) {
            return {
              vector: TypeTagSerializer.parseFromStr(vectorMatch[1], normalizeAddress)
            };
          }
          const structMatch = str.match(STRUCT_REGEX);
          if (structMatch) {
            const address = normalizeAddress ? normalizeSuiAddress(structMatch[1]) : structMatch[1];
            return {
              struct: {
                address,
                module: structMatch[2],
                name: structMatch[3],
                typeParams: structMatch[5] === void 0 ? [] : TypeTagSerializer.parseStructTypeArgs(structMatch[5], normalizeAddress)
              }
            };
          }
          throw new Error(`Encountered unexpected token when parsing type args for ${str}`);
        }
        static parseStructTypeArgs(str, normalizeAddress = false) {
          return splitGenericParameters(str).map(
            (tok) => TypeTagSerializer.parseFromStr(tok, normalizeAddress)
          );
        }
        static tagToString(tag) {
          if ("bool" in tag) {
            return "bool";
          }
          if ("u8" in tag) {
            return "u8";
          }
          if ("u16" in tag) {
            return "u16";
          }
          if ("u32" in tag) {
            return "u32";
          }
          if ("u64" in tag) {
            return "u64";
          }
          if ("u128" in tag) {
            return "u128";
          }
          if ("u256" in tag) {
            return "u256";
          }
          if ("address" in tag) {
            return "address";
          }
          if ("signer" in tag) {
            return "signer";
          }
          if ("vector" in tag) {
            return `vector<${TypeTagSerializer.tagToString(tag.vector)}>`;
          }
          if ("struct" in tag) {
            const struct = tag.struct;
            const typeParams = struct.typeParams.map(TypeTagSerializer.tagToString).join(", ");
            return `${struct.address}::${struct.module}::${struct.name}${typeParams ? `<${typeParams}>` : ""}`;
          }
          throw new Error("Invalid TypeTag");
        }
      } exports("TypeTagSerializer", TypeTagSerializer);

      function unsafe_u64(options) {
        return bcs.u64({
          name: "unsafe_u64",
          ...options
        }).transform({
          input: (val) => val,
          output: (val) => Number(val)
        });
      }
      function optionEnum(type) {
        return bcs.enum("Option", {
          None: null,
          Some: type
        });
      }
      const Address = bcs.bytes(SUI_ADDRESS_LENGTH).transform({
        validate: (val) => {
          const address = typeof val === "string" ? val : toHex(val);
          if (!address || !isValidSuiAddress(normalizeSuiAddress(address))) {
            throw new Error(`Invalid Sui address ${address}`);
          }
        },
        input: (val) => typeof val === "string" ? fromHex(normalizeSuiAddress(val)) : val,
        output: (val) => normalizeSuiAddress(toHex(val))
      });
      const ObjectDigest = bcs.vector(bcs.u8()).transform({
        name: "ObjectDigest",
        input: (value) => fromBase58(value),
        output: (value) => toBase58(new Uint8Array(value)),
        validate: (value) => {
          if (fromBase58(value).length !== 32) {
            throw new Error("ObjectDigest must be 32 bytes");
          }
        }
      });
      const SuiObjectRef = bcs.struct("SuiObjectRef", {
        objectId: Address,
        version: bcs.u64(),
        digest: ObjectDigest
      });
      const SharedObjectRef = bcs.struct("SharedObjectRef", {
        objectId: Address,
        initialSharedVersion: bcs.u64(),
        mutable: bcs.bool()
      });
      const ObjectArg$2 = bcs.enum("ObjectArg", {
        ImmOrOwnedObject: SuiObjectRef,
        SharedObject: SharedObjectRef,
        Receiving: SuiObjectRef
      });
      const Owner = bcs.enum("Owner", {
        AddressOwner: Address,
        ObjectOwner: Address,
        Shared: bcs.struct("Shared", {
          initialSharedVersion: bcs.u64()
        }),
        Immutable: null,
        ConsensusAddressOwner: bcs.struct("ConsensusAddressOwner", {
          owner: Address,
          startVersion: bcs.u64()
        })
      });
      const CallArg$1 = bcs.enum("CallArg", {
        Pure: bcs.struct("Pure", {
          bytes: bcs.vector(bcs.u8()).transform({
            input: (val) => typeof val === "string" ? fromBase64(val) : val,
            output: (val) => toBase64(new Uint8Array(val))
          })
        }),
        Object: ObjectArg$2
      });
      const InnerTypeTag = bcs.enum("TypeTag", {
        bool: null,
        u8: null,
        u64: null,
        u128: null,
        address: null,
        signer: null,
        vector: bcs.lazy(() => InnerTypeTag),
        struct: bcs.lazy(() => StructTag$1),
        u16: null,
        u32: null,
        u256: null
      });
      const TypeTag$1 = InnerTypeTag.transform({
        input: (typeTag) => typeof typeTag === "string" ? TypeTagSerializer.parseFromStr(typeTag, true) : typeTag,
        output: (typeTag) => TypeTagSerializer.tagToString(typeTag)
      });
      const Argument$1 = bcs.enum("Argument", {
        GasCoin: null,
        Input: bcs.u16(),
        Result: bcs.u16(),
        NestedResult: bcs.tuple([bcs.u16(), bcs.u16()])
      });
      const ProgrammableMoveCall$1 = bcs.struct("ProgrammableMoveCall", {
        package: Address,
        module: bcs.string(),
        function: bcs.string(),
        typeArguments: bcs.vector(TypeTag$1),
        arguments: bcs.vector(Argument$1)
      });
      const Command$1 = bcs.enum("Command", {
        /**
         * A Move Call - any public Move function can be called via
         * this transaction. The results can be used that instant to pass
         * into the next transaction.
         */
        MoveCall: ProgrammableMoveCall$1,
        /**
         * Transfer vector of objects to a receiver.
         */
        TransferObjects: bcs.struct("TransferObjects", {
          objects: bcs.vector(Argument$1),
          address: Argument$1
        }),
        // /**
        //  * Split `amount` from a `coin`.
        //  */
        SplitCoins: bcs.struct("SplitCoins", {
          coin: Argument$1,
          amounts: bcs.vector(Argument$1)
        }),
        // /**
        //  * Merge Vector of Coins (`sources`) into a `destination`.
        //  */
        MergeCoins: bcs.struct("MergeCoins", {
          destination: Argument$1,
          sources: bcs.vector(Argument$1)
        }),
        // /**
        //  * Publish a Move module.
        //  */
        Publish: bcs.struct("Publish", {
          modules: bcs.vector(
            bcs.vector(bcs.u8()).transform({
              input: (val) => typeof val === "string" ? fromBase64(val) : val,
              output: (val) => toBase64(new Uint8Array(val))
            })
          ),
          dependencies: bcs.vector(Address)
        }),
        // /**
        //  * Build a vector of objects using the input arguments.
        //  * It is impossible to export construct a `vector<T: key>` otherwise,
        //  * so this call serves a utility function.
        //  */
        MakeMoveVec: bcs.struct("MakeMoveVec", {
          type: optionEnum(TypeTag$1).transform({
            input: (val) => val === null ? {
              None: true
            } : {
              Some: val
            },
            output: (val) => val.Some ?? null
          }),
          elements: bcs.vector(Argument$1)
        }),
        Upgrade: bcs.struct("Upgrade", {
          modules: bcs.vector(
            bcs.vector(bcs.u8()).transform({
              input: (val) => typeof val === "string" ? fromBase64(val) : val,
              output: (val) => toBase64(new Uint8Array(val))
            })
          ),
          dependencies: bcs.vector(Address),
          package: Address,
          ticket: Argument$1
        })
      });
      const ProgrammableTransaction = bcs.struct("ProgrammableTransaction", {
        inputs: bcs.vector(CallArg$1),
        commands: bcs.vector(Command$1)
      });
      const TransactionKind = bcs.enum("TransactionKind", {
        ProgrammableTransaction,
        ChangeEpoch: null,
        Genesis: null,
        ConsensusCommitPrologue: null
      });
      const TransactionExpiration$2 = bcs.enum("TransactionExpiration", {
        None: null,
        Epoch: unsafe_u64()
      });
      const StructTag$1 = bcs.struct("StructTag", {
        address: Address,
        module: bcs.string(),
        name: bcs.string(),
        typeParams: bcs.vector(InnerTypeTag)
      });
      const GasData$1 = bcs.struct("GasData", {
        payment: bcs.vector(SuiObjectRef),
        owner: Address,
        price: bcs.u64(),
        budget: bcs.u64()
      });
      const TransactionDataV1 = bcs.struct("TransactionDataV1", {
        kind: TransactionKind,
        sender: Address,
        gasData: GasData$1,
        expiration: TransactionExpiration$2
      });
      const TransactionData = bcs.enum("TransactionData", {
        V1: TransactionDataV1
      });
      const IntentScope = bcs.enum("IntentScope", {
        TransactionData: null,
        TransactionEffects: null,
        CheckpointSummary: null,
        PersonalMessage: null
      });
      const IntentVersion = bcs.enum("IntentVersion", {
        V0: null
      });
      const AppId = bcs.enum("AppId", {
        Sui: null
      });
      const Intent = bcs.struct("Intent", {
        scope: IntentScope,
        version: IntentVersion,
        appId: AppId
      });
      function IntentMessage(T) {
        return bcs.struct(`IntentMessage<${T.name}>`, {
          intent: Intent,
          value: T
        });
      }
      const CompressedSignature = bcs.enum("CompressedSignature", {
        ED25519: bcs.fixedArray(64, bcs.u8()),
        Secp256k1: bcs.fixedArray(64, bcs.u8()),
        Secp256r1: bcs.fixedArray(64, bcs.u8()),
        ZkLogin: bcs.vector(bcs.u8()),
        Passkey: bcs.vector(bcs.u8())
      });
      const PublicKey$1 = bcs.enum("PublicKey", {
        ED25519: bcs.fixedArray(32, bcs.u8()),
        Secp256k1: bcs.fixedArray(33, bcs.u8()),
        Secp256r1: bcs.fixedArray(33, bcs.u8()),
        ZkLogin: bcs.vector(bcs.u8()),
        Passkey: bcs.fixedArray(33, bcs.u8())
      });
      const MultiSigPkMap = bcs.struct("MultiSigPkMap", {
        pubKey: PublicKey$1,
        weight: bcs.u8()
      });
      const MultiSigPublicKey = bcs.struct("MultiSigPublicKey", {
        pk_map: bcs.vector(MultiSigPkMap),
        threshold: bcs.u16()
      });
      const MultiSig = bcs.struct("MultiSig", {
        sigs: bcs.vector(CompressedSignature),
        bitmap: bcs.u16(),
        multisig_pk: MultiSigPublicKey
      });
      const base64String = bcs.vector(bcs.u8()).transform({
        input: (val) => typeof val === "string" ? fromBase64(val) : val,
        output: (val) => toBase64(new Uint8Array(val))
      });
      const SenderSignedTransaction = bcs.struct("SenderSignedTransaction", {
        intentMessage: IntentMessage(TransactionData),
        txSignatures: bcs.vector(base64String)
      });
      const SenderSignedData = bcs.vector(SenderSignedTransaction, {
        name: "SenderSignedData"
      });
      const PasskeyAuthenticator = bcs.struct("PasskeyAuthenticator", {
        authenticatorData: bcs.vector(bcs.u8()),
        clientDataJson: bcs.string(),
        userSignature: bcs.vector(bcs.u8())
      });

      const PackageUpgradeError = bcs.enum("PackageUpgradeError", {
        UnableToFetchPackage: bcs.struct("UnableToFetchPackage", { packageId: Address }),
        NotAPackage: bcs.struct("NotAPackage", { objectId: Address }),
        IncompatibleUpgrade: null,
        DigestDoesNotMatch: bcs.struct("DigestDoesNotMatch", { digest: bcs.vector(bcs.u8()) }),
        UnknownUpgradePolicy: bcs.struct("UnknownUpgradePolicy", { policy: bcs.u8() }),
        PackageIDDoesNotMatch: bcs.struct("PackageIDDoesNotMatch", {
          packageId: Address,
          ticketId: Address
        })
      });
      const ModuleId = bcs.struct("ModuleId", {
        address: Address,
        name: bcs.string()
      });
      const MoveLocation = bcs.struct("MoveLocation", {
        module: ModuleId,
        function: bcs.u16(),
        instruction: bcs.u16(),
        functionName: bcs.option(bcs.string())
      });
      const CommandArgumentError = bcs.enum("CommandArgumentError", {
        TypeMismatch: null,
        InvalidBCSBytes: null,
        InvalidUsageOfPureArg: null,
        InvalidArgumentToPrivateEntryFunction: null,
        IndexOutOfBounds: bcs.struct("IndexOutOfBounds", { idx: bcs.u16() }),
        SecondaryIndexOutOfBounds: bcs.struct("SecondaryIndexOutOfBounds", {
          resultIdx: bcs.u16(),
          secondaryIdx: bcs.u16()
        }),
        InvalidResultArity: bcs.struct("InvalidResultArity", { resultIdx: bcs.u16() }),
        InvalidGasCoinUsage: null,
        InvalidValueUsage: null,
        InvalidObjectByValue: null,
        InvalidObjectByMutRef: null,
        SharedObjectOperationNotAllowed: null
      });
      const TypeArgumentError = bcs.enum("TypeArgumentError", {
        TypeNotFound: null,
        ConstraintNotSatisfied: null
      });
      const ExecutionFailureStatus = bcs.enum("ExecutionFailureStatus", {
        InsufficientGas: null,
        InvalidGasObject: null,
        InvariantViolation: null,
        FeatureNotYetSupported: null,
        MoveObjectTooBig: bcs.struct("MoveObjectTooBig", {
          objectSize: bcs.u64(),
          maxObjectSize: bcs.u64()
        }),
        MovePackageTooBig: bcs.struct("MovePackageTooBig", {
          objectSize: bcs.u64(),
          maxObjectSize: bcs.u64()
        }),
        CircularObjectOwnership: bcs.struct("CircularObjectOwnership", { object: Address }),
        InsufficientCoinBalance: null,
        CoinBalanceOverflow: null,
        PublishErrorNonZeroAddress: null,
        SuiMoveVerificationError: null,
        MovePrimitiveRuntimeError: bcs.option(MoveLocation),
        MoveAbort: bcs.tuple([MoveLocation, bcs.u64()]),
        VMVerificationOrDeserializationError: null,
        VMInvariantViolation: null,
        FunctionNotFound: null,
        ArityMismatch: null,
        TypeArityMismatch: null,
        NonEntryFunctionInvoked: null,
        CommandArgumentError: bcs.struct("CommandArgumentError", {
          argIdx: bcs.u16(),
          kind: CommandArgumentError
        }),
        TypeArgumentError: bcs.struct("TypeArgumentError", {
          argumentIdx: bcs.u16(),
          kind: TypeArgumentError
        }),
        UnusedValueWithoutDrop: bcs.struct("UnusedValueWithoutDrop", {
          resultIdx: bcs.u16(),
          secondaryIdx: bcs.u16()
        }),
        InvalidPublicFunctionReturnType: bcs.struct("InvalidPublicFunctionReturnType", {
          idx: bcs.u16()
        }),
        InvalidTransferObject: null,
        EffectsTooLarge: bcs.struct("EffectsTooLarge", { currentSize: bcs.u64(), maxSize: bcs.u64() }),
        PublishUpgradeMissingDependency: null,
        PublishUpgradeDependencyDowngrade: null,
        PackageUpgradeError: bcs.struct("PackageUpgradeError", { upgradeError: PackageUpgradeError }),
        WrittenObjectsTooLarge: bcs.struct("WrittenObjectsTooLarge", {
          currentSize: bcs.u64(),
          maxSize: bcs.u64()
        }),
        CertificateDenied: null,
        SuiMoveVerificationTimedout: null,
        SharedObjectOperationNotAllowed: null,
        InputObjectDeleted: null,
        ExecutionCancelledDueToSharedObjectCongestion: bcs.struct(
          "ExecutionCancelledDueToSharedObjectCongestion",
          {
            congestedObjects: bcs.vector(Address)
          }
        ),
        AddressDeniedForCoin: bcs.struct("AddressDeniedForCoin", {
          address: Address,
          coinType: bcs.string()
        }),
        CoinTypeGlobalPause: bcs.struct("CoinTypeGlobalPause", { coinType: bcs.string() }),
        ExecutionCancelledDueToRandomnessUnavailable: null
      });
      const ExecutionStatus = bcs.enum("ExecutionStatus", {
        Success: null,
        Failed: bcs.struct("ExecutionFailed", {
          error: ExecutionFailureStatus,
          command: bcs.option(bcs.u64())
        })
      });
      const GasCostSummary = bcs.struct("GasCostSummary", {
        computationCost: bcs.u64(),
        storageCost: bcs.u64(),
        storageRebate: bcs.u64(),
        nonRefundableStorageFee: bcs.u64()
      });
      const TransactionEffectsV1 = bcs.struct("TransactionEffectsV1", {
        status: ExecutionStatus,
        executedEpoch: bcs.u64(),
        gasUsed: GasCostSummary,
        modifiedAtVersions: bcs.vector(bcs.tuple([Address, bcs.u64()])),
        sharedObjects: bcs.vector(SuiObjectRef),
        transactionDigest: ObjectDigest,
        created: bcs.vector(bcs.tuple([SuiObjectRef, Owner])),
        mutated: bcs.vector(bcs.tuple([SuiObjectRef, Owner])),
        unwrapped: bcs.vector(bcs.tuple([SuiObjectRef, Owner])),
        deleted: bcs.vector(SuiObjectRef),
        unwrappedThenDeleted: bcs.vector(SuiObjectRef),
        wrapped: bcs.vector(SuiObjectRef),
        gasObject: bcs.tuple([SuiObjectRef, Owner]),
        eventsDigest: bcs.option(ObjectDigest),
        dependencies: bcs.vector(ObjectDigest)
      });
      const VersionDigest = bcs.tuple([bcs.u64(), ObjectDigest]);
      const ObjectIn = bcs.enum("ObjectIn", {
        NotExist: null,
        Exist: bcs.tuple([VersionDigest, Owner])
      });
      const ObjectOut = bcs.enum("ObjectOut", {
        NotExist: null,
        ObjectWrite: bcs.tuple([ObjectDigest, Owner]),
        PackageWrite: VersionDigest
      });
      const IDOperation = bcs.enum("IDOperation", {
        None: null,
        Created: null,
        Deleted: null
      });
      const EffectsObjectChange = bcs.struct("EffectsObjectChange", {
        inputState: ObjectIn,
        outputState: ObjectOut,
        idOperation: IDOperation
      });
      const UnchangedSharedKind = bcs.enum("UnchangedSharedKind", {
        ReadOnlyRoot: VersionDigest,
        // TODO: these have been renamed to MutateConsensusStreamEnded and ReadConsensusStreamEnded
        MutateDeleted: bcs.u64(),
        ReadDeleted: bcs.u64(),
        Cancelled: bcs.u64(),
        PerEpochConfig: null
      });
      const TransactionEffectsV2 = bcs.struct("TransactionEffectsV2", {
        status: ExecutionStatus,
        executedEpoch: bcs.u64(),
        gasUsed: GasCostSummary,
        transactionDigest: ObjectDigest,
        gasObjectIndex: bcs.option(bcs.u32()),
        eventsDigest: bcs.option(ObjectDigest),
        dependencies: bcs.vector(ObjectDigest),
        lamportVersion: bcs.u64(),
        changedObjects: bcs.vector(bcs.tuple([Address, EffectsObjectChange])),
        unchangedSharedObjects: bcs.vector(bcs.tuple([Address, UnchangedSharedKind])),
        auxDataDigest: bcs.option(ObjectDigest)
      });
      const TransactionEffects = bcs.enum("TransactionEffects", {
        V1: TransactionEffectsV1,
        V2: TransactionEffectsV2
      });

      function pureBcsSchemaFromTypeName(name) {
        switch (name) {
          case "u8":
            return bcs.u8();
          case "u16":
            return bcs.u16();
          case "u32":
            return bcs.u32();
          case "u64":
            return bcs.u64();
          case "u128":
            return bcs.u128();
          case "u256":
            return bcs.u256();
          case "bool":
            return bcs.bool();
          case "string":
            return bcs.string();
          case "id":
          case "address":
            return Address;
        }
        const generic = name.match(/^(vector|option)<(.+)>$/);
        if (generic) {
          const [kind, inner] = generic.slice(1);
          if (kind === "vector") {
            return bcs.vector(pureBcsSchemaFromTypeName(inner));
          } else {
            return bcs.option(pureBcsSchemaFromTypeName(inner));
          }
        }
        throw new Error(`Invalid Pure type name: ${name}`);
      }

      const suiBcs = exports("bcs", {
        ...bcs,
        U8: bcs.u8(),
        U16: bcs.u16(),
        U32: bcs.u32(),
        U64: bcs.u64(),
        U128: bcs.u128(),
        U256: bcs.u256(),
        ULEB128: bcs.uleb128(),
        Bool: bcs.bool(),
        String: bcs.string(),
        Address,
        AppId,
        Argument: Argument$1,
        CallArg: CallArg$1,
        Command: Command$1,
        CompressedSignature,
        GasData: GasData$1,
        Intent,
        IntentMessage,
        IntentScope,
        IntentVersion,
        MultiSig,
        MultiSigPkMap,
        MultiSigPublicKey,
        ObjectArg: ObjectArg$2,
        ObjectDigest,
        Owner,
        PasskeyAuthenticator,
        ProgrammableMoveCall: ProgrammableMoveCall$1,
        ProgrammableTransaction,
        PublicKey: PublicKey$1,
        SenderSignedData,
        SenderSignedTransaction,
        SharedObjectRef,
        StructTag: StructTag$1,
        SuiObjectRef,
        TransactionData,
        TransactionDataV1,
        TransactionEffects,
        TransactionExpiration: TransactionExpiration$2,
        TransactionKind,
        TypeTag: TypeTag$1
      });

      const ObjectRef = object({
        digest: string(),
        objectId: string(),
        version: union([pipe(number(), integer()), string(), bigint()])
      });
      const ObjectArg$1 = safeEnum({
        ImmOrOwned: ObjectRef,
        Shared: object({
          objectId: ObjectID,
          initialSharedVersion: JsonU64,
          mutable: boolean()
        }),
        Receiving: ObjectRef
      });
      const NormalizedCallArg = safeEnum({
        Object: ObjectArg$1,
        Pure: array(pipe(number(), integer()))
      });
      const TransactionInput = union([
        object({
          kind: literal("Input"),
          index: pipe(number(), integer()),
          value: unknown(),
          type: optional(literal("object"))
        }),
        object({
          kind: literal("Input"),
          index: pipe(number(), integer()),
          value: unknown(),
          type: literal("pure")
        })
      ]);
      const TransactionExpiration$1 = union([
        object({ Epoch: pipe(number(), integer()) }),
        object({ None: nullable(literal(true)) })
      ]);
      const StringEncodedBigint = pipe(
        union([number(), string(), bigint()]),
        check((val) => {
          if (!["string", "number", "bigint"].includes(typeof val)) return false;
          try {
            BigInt(val);
            return true;
          } catch {
            return false;
          }
        })
      );
      const TypeTag = union([
        object({ bool: nullable(literal(true)) }),
        object({ u8: nullable(literal(true)) }),
        object({ u64: nullable(literal(true)) }),
        object({ u128: nullable(literal(true)) }),
        object({ address: nullable(literal(true)) }),
        object({ signer: nullable(literal(true)) }),
        object({ vector: lazy(() => TypeTag) }),
        object({ struct: lazy(() => StructTag) }),
        object({ u16: nullable(literal(true)) }),
        object({ u32: nullable(literal(true)) }),
        object({ u256: nullable(literal(true)) })
      ]);
      const StructTag = object({
        address: string(),
        module: string(),
        name: string(),
        typeParams: array(TypeTag)
      });
      const GasConfig = object({
        budget: optional(StringEncodedBigint),
        price: optional(StringEncodedBigint),
        payment: optional(array(ObjectRef)),
        owner: optional(string())
      });
      const TransactionArgumentTypes = [
        TransactionInput,
        object({ kind: literal("GasCoin") }),
        object({ kind: literal("Result"), index: pipe(number(), integer()) }),
        object({
          kind: literal("NestedResult"),
          index: pipe(number(), integer()),
          resultIndex: pipe(number(), integer())
        })
      ];
      const TransactionArgument = union([...TransactionArgumentTypes]);
      const MoveCallTransaction = object({
        kind: literal("MoveCall"),
        target: pipe(
          string(),
          check((target) => target.split("::").length === 3)
        ),
        typeArguments: array(string()),
        arguments: array(TransactionArgument)
      });
      const TransferObjectsTransaction = object({
        kind: literal("TransferObjects"),
        objects: array(TransactionArgument),
        address: TransactionArgument
      });
      const SplitCoinsTransaction = object({
        kind: literal("SplitCoins"),
        coin: TransactionArgument,
        amounts: array(TransactionArgument)
      });
      const MergeCoinsTransaction = object({
        kind: literal("MergeCoins"),
        destination: TransactionArgument,
        sources: array(TransactionArgument)
      });
      const MakeMoveVecTransaction = object({
        kind: literal("MakeMoveVec"),
        type: union([object({ Some: TypeTag }), object({ None: nullable(literal(true)) })]),
        objects: array(TransactionArgument)
      });
      const PublishTransaction = object({
        kind: literal("Publish"),
        modules: array(array(pipe(number(), integer()))),
        dependencies: array(string())
      });
      const UpgradeTransaction = object({
        kind: literal("Upgrade"),
        modules: array(array(pipe(number(), integer()))),
        dependencies: array(string()),
        packageId: string(),
        ticket: TransactionArgument
      });
      const TransactionTypes = [
        MoveCallTransaction,
        TransferObjectsTransaction,
        SplitCoinsTransaction,
        MergeCoinsTransaction,
        PublishTransaction,
        UpgradeTransaction,
        MakeMoveVecTransaction
      ];
      const TransactionType = union([...TransactionTypes]);
      object({
        version: literal(1),
        sender: optional(string()),
        expiration: nullish(TransactionExpiration$1),
        gasConfig: GasConfig,
        inputs: array(TransactionInput),
        transactions: array(TransactionType)
      });
      function serializeV1TransactionData(transactionData) {
        const inputs = transactionData.inputs.map(
          (input, index) => {
            if (input.Object) {
              return {
                kind: "Input",
                index,
                value: {
                  Object: input.Object.ImmOrOwnedObject ? {
                    ImmOrOwned: input.Object.ImmOrOwnedObject
                  } : input.Object.Receiving ? {
                    Receiving: {
                      digest: input.Object.Receiving.digest,
                      version: input.Object.Receiving.version,
                      objectId: input.Object.Receiving.objectId
                    }
                  } : {
                    Shared: {
                      mutable: input.Object.SharedObject.mutable,
                      initialSharedVersion: input.Object.SharedObject.initialSharedVersion,
                      objectId: input.Object.SharedObject.objectId
                    }
                  }
                },
                type: "object"
              };
            }
            if (input.Pure) {
              return {
                kind: "Input",
                index,
                value: {
                  Pure: Array.from(fromBase64(input.Pure.bytes))
                },
                type: "pure"
              };
            }
            if (input.UnresolvedPure) {
              return {
                kind: "Input",
                type: "pure",
                index,
                value: input.UnresolvedPure.value
              };
            }
            if (input.UnresolvedObject) {
              return {
                kind: "Input",
                type: "object",
                index,
                value: input.UnresolvedObject.objectId
              };
            }
            throw new Error("Invalid input");
          }
        );
        return {
          version: 1,
          sender: transactionData.sender ?? void 0,
          expiration: transactionData.expiration?.$kind === "Epoch" ? { Epoch: Number(transactionData.expiration.Epoch) } : transactionData.expiration ? { None: true } : null,
          gasConfig: {
            owner: transactionData.gasData.owner ?? void 0,
            budget: transactionData.gasData.budget ?? void 0,
            price: transactionData.gasData.price ?? void 0,
            payment: transactionData.gasData.payment ?? void 0
          },
          inputs,
          transactions: transactionData.commands.map((command) => {
            if (command.MakeMoveVec) {
              return {
                kind: "MakeMoveVec",
                type: command.MakeMoveVec.type === null ? { None: true } : { Some: TypeTagSerializer.parseFromStr(command.MakeMoveVec.type) },
                objects: command.MakeMoveVec.elements.map(
                  (arg) => convertTransactionArgument(arg, inputs)
                )
              };
            }
            if (command.MergeCoins) {
              return {
                kind: "MergeCoins",
                destination: convertTransactionArgument(command.MergeCoins.destination, inputs),
                sources: command.MergeCoins.sources.map((arg) => convertTransactionArgument(arg, inputs))
              };
            }
            if (command.MoveCall) {
              return {
                kind: "MoveCall",
                target: `${command.MoveCall.package}::${command.MoveCall.module}::${command.MoveCall.function}`,
                typeArguments: command.MoveCall.typeArguments,
                arguments: command.MoveCall.arguments.map(
                  (arg) => convertTransactionArgument(arg, inputs)
                )
              };
            }
            if (command.Publish) {
              return {
                kind: "Publish",
                modules: command.Publish.modules.map((mod) => Array.from(fromBase64(mod))),
                dependencies: command.Publish.dependencies
              };
            }
            if (command.SplitCoins) {
              return {
                kind: "SplitCoins",
                coin: convertTransactionArgument(command.SplitCoins.coin, inputs),
                amounts: command.SplitCoins.amounts.map((arg) => convertTransactionArgument(arg, inputs))
              };
            }
            if (command.TransferObjects) {
              return {
                kind: "TransferObjects",
                objects: command.TransferObjects.objects.map(
                  (arg) => convertTransactionArgument(arg, inputs)
                ),
                address: convertTransactionArgument(command.TransferObjects.address, inputs)
              };
            }
            if (command.Upgrade) {
              return {
                kind: "Upgrade",
                modules: command.Upgrade.modules.map((mod) => Array.from(fromBase64(mod))),
                dependencies: command.Upgrade.dependencies,
                packageId: command.Upgrade.package,
                ticket: convertTransactionArgument(command.Upgrade.ticket, inputs)
              };
            }
            throw new Error(`Unknown transaction ${Object.keys(command)}`);
          })
        };
      }
      function convertTransactionArgument(arg, inputs) {
        if (arg.$kind === "GasCoin") {
          return { kind: "GasCoin" };
        }
        if (arg.$kind === "Result") {
          return { kind: "Result", index: arg.Result };
        }
        if (arg.$kind === "NestedResult") {
          return { kind: "NestedResult", index: arg.NestedResult[0], resultIndex: arg.NestedResult[1] };
        }
        if (arg.$kind === "Input") {
          return inputs[arg.Input];
        }
        throw new Error(`Invalid argument ${Object.keys(arg)}`);
      }
      function transactionDataFromV1(data) {
        return parse(TransactionDataSchema, {
          version: 2,
          sender: data.sender ?? null,
          expiration: data.expiration ? "Epoch" in data.expiration ? { Epoch: data.expiration.Epoch } : { None: true } : null,
          gasData: {
            owner: data.gasConfig.owner ?? null,
            budget: data.gasConfig.budget?.toString() ?? null,
            price: data.gasConfig.price?.toString() ?? null,
            payment: data.gasConfig.payment?.map((ref) => ({
              digest: ref.digest,
              objectId: ref.objectId,
              version: ref.version.toString()
            })) ?? null
          },
          inputs: data.inputs.map((input) => {
            if (input.kind === "Input") {
              if (is(NormalizedCallArg, input.value)) {
                const value = parse(NormalizedCallArg, input.value);
                if (value.Object) {
                  if (value.Object.ImmOrOwned) {
                    return {
                      Object: {
                        ImmOrOwnedObject: {
                          objectId: value.Object.ImmOrOwned.objectId,
                          version: String(value.Object.ImmOrOwned.version),
                          digest: value.Object.ImmOrOwned.digest
                        }
                      }
                    };
                  }
                  if (value.Object.Shared) {
                    return {
                      Object: {
                        SharedObject: {
                          mutable: value.Object.Shared.mutable ?? null,
                          initialSharedVersion: value.Object.Shared.initialSharedVersion,
                          objectId: value.Object.Shared.objectId
                        }
                      }
                    };
                  }
                  if (value.Object.Receiving) {
                    return {
                      Object: {
                        Receiving: {
                          digest: value.Object.Receiving.digest,
                          version: String(value.Object.Receiving.version),
                          objectId: value.Object.Receiving.objectId
                        }
                      }
                    };
                  }
                  throw new Error("Invalid object input");
                }
                return {
                  Pure: {
                    bytes: toBase64(new Uint8Array(value.Pure))
                  }
                };
              }
              if (input.type === "object") {
                return {
                  UnresolvedObject: {
                    objectId: input.value
                  }
                };
              }
              return {
                UnresolvedPure: {
                  value: input.value
                }
              };
            }
            throw new Error("Invalid input");
          }),
          commands: data.transactions.map((transaction) => {
            switch (transaction.kind) {
              case "MakeMoveVec":
                return {
                  MakeMoveVec: {
                    type: "Some" in transaction.type ? TypeTagSerializer.tagToString(transaction.type.Some) : null,
                    elements: transaction.objects.map((arg) => parseV1TransactionArgument(arg))
                  }
                };
              case "MergeCoins": {
                return {
                  MergeCoins: {
                    destination: parseV1TransactionArgument(transaction.destination),
                    sources: transaction.sources.map((arg) => parseV1TransactionArgument(arg))
                  }
                };
              }
              case "MoveCall": {
                const [pkg, mod, fn] = transaction.target.split("::");
                return {
                  MoveCall: {
                    package: pkg,
                    module: mod,
                    function: fn,
                    typeArguments: transaction.typeArguments,
                    arguments: transaction.arguments.map((arg) => parseV1TransactionArgument(arg))
                  }
                };
              }
              case "Publish": {
                return {
                  Publish: {
                    modules: transaction.modules.map((mod) => toBase64(Uint8Array.from(mod))),
                    dependencies: transaction.dependencies
                  }
                };
              }
              case "SplitCoins": {
                return {
                  SplitCoins: {
                    coin: parseV1TransactionArgument(transaction.coin),
                    amounts: transaction.amounts.map((arg) => parseV1TransactionArgument(arg))
                  }
                };
              }
              case "TransferObjects": {
                return {
                  TransferObjects: {
                    objects: transaction.objects.map((arg) => parseV1TransactionArgument(arg)),
                    address: parseV1TransactionArgument(transaction.address)
                  }
                };
              }
              case "Upgrade": {
                return {
                  Upgrade: {
                    modules: transaction.modules.map((mod) => toBase64(Uint8Array.from(mod))),
                    dependencies: transaction.dependencies,
                    package: transaction.packageId,
                    ticket: parseV1TransactionArgument(transaction.ticket)
                  }
                };
              }
            }
            throw new Error(`Unknown transaction ${Object.keys(transaction)}`);
          })
        });
      }
      function parseV1TransactionArgument(arg) {
        switch (arg.kind) {
          case "GasCoin": {
            return { GasCoin: true };
          }
          case "Result":
            return { Result: arg.index };
          case "NestedResult": {
            return { NestedResult: [arg.index, arg.resultIndex] };
          }
          case "Input": {
            return { Input: arg.index };
          }
        }
      }

      function enumUnion(options) {
        return union(
          Object.entries(options).map(([key, value]) => object({ [key]: value }))
        );
      }
      const Argument = enumUnion({
        GasCoin: literal(true),
        Input: pipe(number(), integer()),
        Result: pipe(number(), integer()),
        NestedResult: tuple([pipe(number(), integer()), pipe(number(), integer())])
      });
      const GasData = object({
        budget: nullable(JsonU64),
        price: nullable(JsonU64),
        owner: nullable(SuiAddress),
        payment: nullable(array(ObjectRefSchema))
      });
      const ProgrammableMoveCall = object({
        package: ObjectID,
        module: string(),
        function: string(),
        // snake case in rust
        typeArguments: array(string()),
        arguments: array(Argument)
      });
      const $Intent = object({
        name: string(),
        inputs: record(string(), union([Argument, array(Argument)])),
        data: record(string(), unknown())
      });
      const Command = enumUnion({
        MoveCall: ProgrammableMoveCall,
        TransferObjects: object({
          objects: array(Argument),
          address: Argument
        }),
        SplitCoins: object({
          coin: Argument,
          amounts: array(Argument)
        }),
        MergeCoins: object({
          destination: Argument,
          sources: array(Argument)
        }),
        Publish: object({
          modules: array(BCSBytes),
          dependencies: array(ObjectID)
        }),
        MakeMoveVec: object({
          type: nullable(string()),
          elements: array(Argument)
        }),
        Upgrade: object({
          modules: array(BCSBytes),
          dependencies: array(ObjectID),
          package: ObjectID,
          ticket: Argument
        }),
        $Intent
      });
      const ObjectArg = enumUnion({
        ImmOrOwnedObject: ObjectRefSchema,
        SharedObject: object({
          objectId: ObjectID,
          // snake case in rust
          initialSharedVersion: JsonU64,
          mutable: boolean()
        }),
        Receiving: ObjectRefSchema
      });
      const CallArg = enumUnion({
        Object: ObjectArg,
        Pure: object({
          bytes: BCSBytes
        }),
        UnresolvedPure: object({
          value: unknown()
        }),
        UnresolvedObject: object({
          objectId: ObjectID,
          version: optional(nullable(JsonU64)),
          digest: optional(nullable(string())),
          initialSharedVersion: optional(nullable(JsonU64)),
          mutable: optional(nullable(boolean()))
        })
      });
      const TransactionExpiration = enumUnion({
        None: literal(true),
        Epoch: JsonU64
      });
      const SerializedTransactionDataV2Schema = object({
        version: literal(2),
        sender: nullish(SuiAddress),
        expiration: nullish(TransactionExpiration),
        gasData: GasData,
        inputs: array(CallArg),
        commands: array(Command),
        digest: optional(nullable(string()))
      });

      function Pure(data) {
        return {
          $kind: "Pure",
          Pure: {
            bytes: data instanceof Uint8Array ? toBase64(data) : data.toBase64()
          }
        };
      }
      const Inputs = exports("Inputs", {
        Pure,
        ObjectRef({ objectId, digest, version }) {
          return {
            $kind: "Object",
            Object: {
              $kind: "ImmOrOwnedObject",
              ImmOrOwnedObject: {
                digest,
                version,
                objectId: normalizeSuiAddress(objectId)
              }
            }
          };
        },
        SharedObjectRef({
          objectId,
          mutable,
          initialSharedVersion
        }) {
          return {
            $kind: "Object",
            Object: {
              $kind: "SharedObject",
              SharedObject: {
                mutable,
                initialSharedVersion,
                objectId: normalizeSuiAddress(objectId)
              }
            }
          };
        },
        ReceivingRef({ objectId, digest, version }) {
          return {
            $kind: "Object",
            Object: {
              $kind: "Receiving",
              Receiving: {
                digest,
                version,
                objectId: normalizeSuiAddress(objectId)
              }
            }
          };
        }
      });

      const ELLIPSIS = "\u2026";
      function formatAddress(address) {
        if (address.length <= 6) {
          return address;
        }
        const offset = address.startsWith("0x") ? 2 : 0;
        return `0x${address.slice(offset, offset + 4)}${ELLIPSIS}${address.slice(-4)}`;
      }
      function formatDigest(digest) {
        return `${digest.slice(0, 10)}${ELLIPSIS}`;
      }

      const SUI_DECIMALS = exports("SUI_DECIMALS", 9);
      const MIST_PER_SUI = exports("MIST_PER_SUI", BigInt(1e9));
      const MOVE_STDLIB_ADDRESS = exports("MOVE_STDLIB_ADDRESS", "0x1");
      const SUI_FRAMEWORK_ADDRESS = exports("SUI_FRAMEWORK_ADDRESS", "0x2");
      const SUI_SYSTEM_ADDRESS = exports("SUI_SYSTEM_ADDRESS", "0x3");
      const SUI_CLOCK_OBJECT_ID = exports("SUI_CLOCK_OBJECT_ID", normalizeSuiObjectId("0x6"));
      const SUI_SYSTEM_MODULE_NAME = exports("SUI_SYSTEM_MODULE_NAME", "sui_system");
      const SUI_TYPE_ARG = exports("SUI_TYPE_ARG", `${SUI_FRAMEWORK_ADDRESS}::sui::SUI`);
      const SUI_SYSTEM_STATE_OBJECT_ID = exports("SUI_SYSTEM_STATE_OBJECT_ID", normalizeSuiObjectId("0x5"));
      const SUI_RANDOM_OBJECT_ID = exports("SUI_RANDOM_OBJECT_ID", normalizeSuiObjectId("0x8"));

      const crypto = typeof globalThis === 'object' && 'crypto' in globalThis ? globalThis.crypto : undefined;

      /**
       * Utilities for hex, bytes, CSPRNG.
       * @module
       */
      /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
      // We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
      // node.js versions earlier than v19 don't declare it in global scope.
      // For node.js, package.json#exports field mapping rewrites import
      // from `crypto` to `cryptoNode`, which imports native module.
      // Makes the utils un-importable in browsers without a bundler.
      // Once node.js 18 is deprecated (2025-04-30), we can just drop the import.
      /** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
      function isBytes(a) {
          return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
      }
      /** Asserts something is positive integer. */
      function anumber(n) {
          if (!Number.isSafeInteger(n) || n < 0)
              throw new Error('positive integer expected, got ' + n);
      }
      /** Asserts something is Uint8Array. */
      function abytes(b, ...lengths) {
          if (!isBytes(b))
              throw new Error('Uint8Array expected');
          if (lengths.length > 0 && !lengths.includes(b.length))
              throw new Error('Uint8Array expected of length ' + lengths + ', got length=' + b.length);
      }
      /** Asserts something is hash */
      function ahash(h) {
          if (typeof h !== 'function' || typeof h.create !== 'function')
              throw new Error('Hash should be wrapped by utils.createHasher');
          anumber(h.outputLen);
          anumber(h.blockLen);
      }
      /** Asserts a hash instance has not been destroyed / finished */
      function aexists(instance, checkFinished = true) {
          if (instance.destroyed)
              throw new Error('Hash instance has been destroyed');
          if (checkFinished && instance.finished)
              throw new Error('Hash#digest() has already been called');
      }
      /** Asserts output is properly-sized byte array */
      function aoutput(out, instance) {
          abytes(out);
          const min = instance.outputLen;
          if (out.length < min) {
              throw new Error('digestInto() expects output buffer of length at least ' + min);
          }
      }
      /** Cast u8 / u16 / u32 to u32. */
      function u32(arr) {
          return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
      }
      /** Zeroize a byte array. Warning: JS provides no guarantees. */
      function clean(...arrays) {
          for (let i = 0; i < arrays.length; i++) {
              arrays[i].fill(0);
          }
      }
      /** Create DataView of an array for easy byte-level manipulation. */
      function createView(arr) {
          return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
      }
      /** Is current platform little-endian? Most are. Big-Endian platform: IBM */
      const isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
      /** The byte swap operation for uint32 */
      function byteSwap(word) {
          return (((word << 24) & 0xff000000) |
              ((word << 8) & 0xff0000) |
              ((word >>> 8) & 0xff00) |
              ((word >>> 24) & 0xff));
      }
      /** Conditionally byte swap if on a big-endian platform */
      const swap8IfBE = isLE
          ? (n) => n
          : (n) => byteSwap(n);
      /** In place byte swap for Uint32Array */
      function byteSwap32(arr) {
          for (let i = 0; i < arr.length; i++) {
              arr[i] = byteSwap(arr[i]);
          }
          return arr;
      }
      const swap32IfBE = isLE
          ? (u) => u
          : byteSwap32;
      // Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
      const hasHexBuiltin = /* @__PURE__ */ (() => 
      // @ts-ignore
      typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
      // Array where index 0xf0 (240) is mapped to string 'f0'
      const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
      /**
       * Convert byte array to hex string. Uses built-in function, when available.
       * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
       */
      function bytesToHex(bytes) {
          abytes(bytes);
          // @ts-ignore
          if (hasHexBuiltin)
              return bytes.toHex();
          // pre-caching improves the speed 6x
          let hex = '';
          for (let i = 0; i < bytes.length; i++) {
              hex += hexes[bytes[i]];
          }
          return hex;
      }
      // We use optimized technique to convert hex string to byte array
      const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
      function asciiToBase16(ch) {
          if (ch >= asciis._0 && ch <= asciis._9)
              return ch - asciis._0; // '2' => 50-48
          if (ch >= asciis.A && ch <= asciis.F)
              return ch - (asciis.A - 10); // 'B' => 66-(65-10)
          if (ch >= asciis.a && ch <= asciis.f)
              return ch - (asciis.a - 10); // 'b' => 98-(97-10)
          return;
      }
      /**
       * Convert hex string to byte array. Uses built-in function, when available.
       * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
       */
      function hexToBytes(hex) {
          if (typeof hex !== 'string')
              throw new Error('hex string expected, got ' + typeof hex);
          // @ts-ignore
          if (hasHexBuiltin)
              return Uint8Array.fromHex(hex);
          const hl = hex.length;
          const al = hl / 2;
          if (hl % 2)
              throw new Error('hex string expected, got unpadded hex of length ' + hl);
          const array = new Uint8Array(al);
          for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
              const n1 = asciiToBase16(hex.charCodeAt(hi));
              const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
              if (n1 === undefined || n2 === undefined) {
                  const char = hex[hi] + hex[hi + 1];
                  throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
              }
              array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
          }
          return array;
      }
      /**
       * Converts string to bytes using UTF8 encoding.
       * @example utf8ToBytes('abc') // Uint8Array.from([97, 98, 99])
       */
      function utf8ToBytes(str) {
          if (typeof str !== 'string')
              throw new Error('string expected');
          return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
      }
      /**
       * Normalizes (non-hex) string or Uint8Array to Uint8Array.
       * Warning: when Uint8Array is passed, it would NOT get copied.
       * Keep in mind for future mutable operations.
       */
      function toBytes(data) {
          if (typeof data === 'string')
              data = utf8ToBytes(data);
          abytes(data);
          return data;
      }
      /**
       * Helper for KDFs: consumes uint8array or string.
       * When string is passed, does utf8 decoding, using TextDecoder.
       */
      function kdfInputToBytes(data) {
          if (typeof data === 'string')
              data = utf8ToBytes(data);
          abytes(data);
          return data;
      }
      /** Copies several Uint8Arrays into one. */
      function concatBytes$1(...arrays) {
          let sum = 0;
          for (let i = 0; i < arrays.length; i++) {
              const a = arrays[i];
              abytes(a);
              sum += a.length;
          }
          const res = new Uint8Array(sum);
          for (let i = 0, pad = 0; i < arrays.length; i++) {
              const a = arrays[i];
              res.set(a, pad);
              pad += a.length;
          }
          return res;
      }
      function checkOpts(defaults, opts) {
          if (opts !== undefined && {}.toString.call(opts) !== '[object Object]')
              throw new Error('options should be object or undefined');
          const merged = Object.assign(defaults, opts);
          return merged;
      }
      /** For runtime check if class implements interface */
      class Hash {
      }
      /** Wraps hash function, creating an interface on top of it */
      function createHasher(hashCons) {
          const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
          const tmp = hashCons();
          hashC.outputLen = tmp.outputLen;
          hashC.blockLen = tmp.blockLen;
          hashC.create = () => hashCons();
          return hashC;
      }
      function createOptHasher(hashCons) {
          const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
          const tmp = hashCons({});
          hashC.outputLen = tmp.outputLen;
          hashC.blockLen = tmp.blockLen;
          hashC.create = (opts) => hashCons(opts);
          return hashC;
      }
      /** Cryptographically secure PRNG. Uses internal OS-level `crypto.getRandomValues`. */
      function randomBytes(bytesLength = 32) {
          if (crypto && typeof crypto.getRandomValues === 'function') {
              return crypto.getRandomValues(new Uint8Array(bytesLength));
          }
          // Legacy Node.js compatibility
          if (crypto && typeof crypto.randomBytes === 'function') {
              return Uint8Array.from(crypto.randomBytes(bytesLength));
          }
          throw new Error('crypto.getRandomValues must be defined');
      }

      /**
       * Internal helpers for blake hash.
       * @module
       */
      /**
       * Internal blake variable.
       * For BLAKE2b, the two extra permutations for rounds 10 and 11 are SIGMA[10..11] = SIGMA[0..1].
       */
      // prettier-ignore
      const BSIGMA = /* @__PURE__ */ Uint8Array.from([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
          14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
          11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
          7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
          9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
          2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
          12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11,
          13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10,
          6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5,
          10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
          14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
          // Blake1, unused in others
          11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
          7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
          9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
          2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
      ]);

      /**
       * Internal Merkle-Damgard hash utils.
       * @module
       */
      /** Polyfill for Safari 14. https://caniuse.com/mdn-javascript_builtins_dataview_setbiguint64 */
      function setBigUint64(view, byteOffset, value, isLE) {
          if (typeof view.setBigUint64 === 'function')
              return view.setBigUint64(byteOffset, value, isLE);
          const _32n = BigInt(32);
          const _u32_max = BigInt(0xffffffff);
          const wh = Number((value >> _32n) & _u32_max);
          const wl = Number(value & _u32_max);
          const h = isLE ? 4 : 0;
          const l = isLE ? 0 : 4;
          view.setUint32(byteOffset + h, wh, isLE);
          view.setUint32(byteOffset + l, wl, isLE);
      }
      /**
       * Merkle-Damgard hash construction base class.
       * Could be used to create MD5, RIPEMD, SHA1, SHA2.
       */
      class HashMD extends Hash {
          constructor(blockLen, outputLen, padOffset, isLE) {
              super();
              this.finished = false;
              this.length = 0;
              this.pos = 0;
              this.destroyed = false;
              this.blockLen = blockLen;
              this.outputLen = outputLen;
              this.padOffset = padOffset;
              this.isLE = isLE;
              this.buffer = new Uint8Array(blockLen);
              this.view = createView(this.buffer);
          }
          update(data) {
              aexists(this);
              data = toBytes(data);
              abytes(data);
              const { view, buffer, blockLen } = this;
              const len = data.length;
              for (let pos = 0; pos < len;) {
                  const take = Math.min(blockLen - this.pos, len - pos);
                  // Fast path: we have at least one block in input, cast it to view and process
                  if (take === blockLen) {
                      const dataView = createView(data);
                      for (; blockLen <= len - pos; pos += blockLen)
                          this.process(dataView, pos);
                      continue;
                  }
                  buffer.set(data.subarray(pos, pos + take), this.pos);
                  this.pos += take;
                  pos += take;
                  if (this.pos === blockLen) {
                      this.process(view, 0);
                      this.pos = 0;
                  }
              }
              this.length += data.length;
              this.roundClean();
              return this;
          }
          digestInto(out) {
              aexists(this);
              aoutput(out, this);
              this.finished = true;
              // Padding
              // We can avoid allocation of buffer for padding completely if it
              // was previously not allocated here. But it won't change performance.
              const { buffer, view, blockLen, isLE } = this;
              let { pos } = this;
              // append the bit '1' to the message
              buffer[pos++] = 0b10000000;
              clean(this.buffer.subarray(pos));
              // we have less than padOffset left in buffer, so we cannot put length in
              // current block, need process it and pad again
              if (this.padOffset > blockLen - pos) {
                  this.process(view, 0);
                  pos = 0;
              }
              // Pad until full block byte with zeros
              for (let i = pos; i < blockLen; i++)
                  buffer[i] = 0;
              // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
              // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
              // So we just write lowest 64 bits of that value.
              setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
              this.process(view, 0);
              const oview = createView(out);
              const len = this.outputLen;
              // NOTE: we do division by 4 later, which should be fused in single op with modulo by JIT
              if (len % 4)
                  throw new Error('_sha2: outputLen should be aligned to 32bit');
              const outLen = len / 4;
              const state = this.get();
              if (outLen > state.length)
                  throw new Error('_sha2: outputLen bigger than state');
              for (let i = 0; i < outLen; i++)
                  oview.setUint32(4 * i, state[i], isLE);
          }
          digest() {
              const { buffer, outputLen } = this;
              this.digestInto(buffer);
              const res = buffer.slice(0, outputLen);
              this.destroy();
              return res;
          }
          _cloneInto(to) {
              to || (to = new this.constructor());
              to.set(...this.get());
              const { blockLen, buffer, length, finished, destroyed, pos } = this;
              to.destroyed = destroyed;
              to.finished = finished;
              to.length = length;
              to.pos = pos;
              if (length % blockLen)
                  to.buffer.set(buffer);
              return to;
          }
          clone() {
              return this._cloneInto();
          }
      }
      /** Initial SHA512 state. Bits 0..64 of frac part of sqrt of primes 2..19 */
      const SHA512_IV = /* @__PURE__ */ Uint32Array.from([
          0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1,
          0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179,
      ]);

      /**
       * Internal helpers for u64. BigUint64Array is too slow as per 2025, so we implement it using Uint32Array.
       * @todo re-check https://issues.chromium.org/issues/42212588
       * @module
       */
      const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
      const _32n = /* @__PURE__ */ BigInt(32);
      function fromBig(n, le = false) {
          if (le)
              return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
          return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
      }
      function split(lst, le = false) {
          const len = lst.length;
          let Ah = new Uint32Array(len);
          let Al = new Uint32Array(len);
          for (let i = 0; i < len; i++) {
              const { h, l } = fromBig(lst[i], le);
              [Ah[i], Al[i]] = [h, l];
          }
          return [Ah, Al];
      }
      // for Shift in [0, 32)
      const shrSH = (h, _l, s) => h >>> s;
      const shrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
      // Right rotate for Shift in [1, 32)
      const rotrSH = (h, l, s) => (h >>> s) | (l << (32 - s));
      const rotrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
      // Right rotate for Shift in (32, 64), NOTE: 32 is special case.
      const rotrBH = (h, l, s) => (h << (64 - s)) | (l >>> (s - 32));
      const rotrBL = (h, l, s) => (h >>> (s - 32)) | (l << (64 - s));
      // Right rotate for shift===32 (just swaps l&h)
      const rotr32H = (_h, l) => l;
      const rotr32L = (h, _l) => h;
      // JS uses 32-bit signed integers for bitwise operations which means we cannot
      // simple take carry out of low bit sum by shift, we need to use division.
      function add(Ah, Al, Bh, Bl) {
          const l = (Al >>> 0) + (Bl >>> 0);
          return { h: (Ah + Bh + ((l / 2 ** 32) | 0)) | 0, l: l | 0 };
      }
      // Addition with more than 2 elements
      const add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
      const add3H = (low, Ah, Bh, Ch) => (Ah + Bh + Ch + ((low / 2 ** 32) | 0)) | 0;
      const add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
      const add4H = (low, Ah, Bh, Ch, Dh) => (Ah + Bh + Ch + Dh + ((low / 2 ** 32) | 0)) | 0;
      const add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
      const add5H = (low, Ah, Bh, Ch, Dh, Eh) => (Ah + Bh + Ch + Dh + Eh + ((low / 2 ** 32) | 0)) | 0;

      /**
       * blake2b (64-bit) & blake2s (8 to 32-bit) hash functions.
       * b could have been faster, but there is no fast u64 in js, so s is 1.5x faster.
       * @module
       */
      // Same as SHA512_IV, but swapped endianness: LE instead of BE. iv[1] is iv[0], etc.
      const B2B_IV = /* @__PURE__ */ Uint32Array.from([
          0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
          0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c, 0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19,
      ]);
      // Temporary buffer
      const BBUF = /* @__PURE__ */ new Uint32Array(32);
      // Mixing function G splitted in two halfs
      function G1b(a, b, c, d, msg, x) {
          // NOTE: V is LE here
          const Xl = msg[x], Xh = msg[x + 1]; // prettier-ignore
          let Al = BBUF[2 * a], Ah = BBUF[2 * a + 1]; // prettier-ignore
          let Bl = BBUF[2 * b], Bh = BBUF[2 * b + 1]; // prettier-ignore
          let Cl = BBUF[2 * c], Ch = BBUF[2 * c + 1]; // prettier-ignore
          let Dl = BBUF[2 * d], Dh = BBUF[2 * d + 1]; // prettier-ignore
          // v[a] = (v[a] + v[b] + x) | 0;
          let ll = add3L(Al, Bl, Xl);
          Ah = add3H(ll, Ah, Bh, Xh);
          Al = ll | 0;
          // v[d] = rotr(v[d] ^ v[a], 32)
          ({ Dh, Dl } = { Dh: Dh ^ Ah, Dl: Dl ^ Al });
          ({ Dh, Dl } = { Dh: rotr32H(Dh, Dl), Dl: rotr32L(Dh) });
          // v[c] = (v[c] + v[d]) | 0;
          ({ h: Ch, l: Cl } = add(Ch, Cl, Dh, Dl));
          // v[b] = rotr(v[b] ^ v[c], 24)
          ({ Bh, Bl } = { Bh: Bh ^ Ch, Bl: Bl ^ Cl });
          ({ Bh, Bl } = { Bh: rotrSH(Bh, Bl, 24), Bl: rotrSL(Bh, Bl, 24) });
          (BBUF[2 * a] = Al), (BBUF[2 * a + 1] = Ah);
          (BBUF[2 * b] = Bl), (BBUF[2 * b + 1] = Bh);
          (BBUF[2 * c] = Cl), (BBUF[2 * c + 1] = Ch);
          (BBUF[2 * d] = Dl), (BBUF[2 * d + 1] = Dh);
      }
      function G2b(a, b, c, d, msg, x) {
          // NOTE: V is LE here
          const Xl = msg[x], Xh = msg[x + 1]; // prettier-ignore
          let Al = BBUF[2 * a], Ah = BBUF[2 * a + 1]; // prettier-ignore
          let Bl = BBUF[2 * b], Bh = BBUF[2 * b + 1]; // prettier-ignore
          let Cl = BBUF[2 * c], Ch = BBUF[2 * c + 1]; // prettier-ignore
          let Dl = BBUF[2 * d], Dh = BBUF[2 * d + 1]; // prettier-ignore
          // v[a] = (v[a] + v[b] + x) | 0;
          let ll = add3L(Al, Bl, Xl);
          Ah = add3H(ll, Ah, Bh, Xh);
          Al = ll | 0;
          // v[d] = rotr(v[d] ^ v[a], 16)
          ({ Dh, Dl } = { Dh: Dh ^ Ah, Dl: Dl ^ Al });
          ({ Dh, Dl } = { Dh: rotrSH(Dh, Dl, 16), Dl: rotrSL(Dh, Dl, 16) });
          // v[c] = (v[c] + v[d]) | 0;
          ({ h: Ch, l: Cl } = add(Ch, Cl, Dh, Dl));
          // v[b] = rotr(v[b] ^ v[c], 63)
          ({ Bh, Bl } = { Bh: Bh ^ Ch, Bl: Bl ^ Cl });
          ({ Bh, Bl } = { Bh: rotrBH(Bh, Bl, 63), Bl: rotrBL(Bh, Bl, 63) });
          (BBUF[2 * a] = Al), (BBUF[2 * a + 1] = Ah);
          (BBUF[2 * b] = Bl), (BBUF[2 * b + 1] = Bh);
          (BBUF[2 * c] = Cl), (BBUF[2 * c + 1] = Ch);
          (BBUF[2 * d] = Dl), (BBUF[2 * d + 1] = Dh);
      }
      function checkBlake2Opts(outputLen, opts = {}, keyLen, saltLen, persLen) {
          anumber(keyLen);
          if (outputLen < 0 || outputLen > keyLen)
              throw new Error('outputLen bigger than keyLen');
          const { key, salt, personalization } = opts;
          if (key !== undefined && (key.length < 1 || key.length > keyLen))
              throw new Error('key length must be undefined or 1..' + keyLen);
          if (salt !== undefined && salt.length !== saltLen)
              throw new Error('salt must be undefined or ' + saltLen);
          if (personalization !== undefined && personalization.length !== persLen)
              throw new Error('personalization must be undefined or ' + persLen);
      }
      /** Class, from which others are subclassed. */
      class BLAKE2 extends Hash {
          constructor(blockLen, outputLen) {
              super();
              this.finished = false;
              this.destroyed = false;
              this.length = 0;
              this.pos = 0;
              anumber(blockLen);
              anumber(outputLen);
              this.blockLen = blockLen;
              this.outputLen = outputLen;
              this.buffer = new Uint8Array(blockLen);
              this.buffer32 = u32(this.buffer);
          }
          update(data) {
              aexists(this);
              data = toBytes(data);
              abytes(data);
              // Main difference with other hashes: there is flag for last block,
              // so we cannot process current block before we know that there
              // is the next one. This significantly complicates logic and reduces ability
              // to do zero-copy processing
              const { blockLen, buffer, buffer32 } = this;
              const len = data.length;
              const offset = data.byteOffset;
              const buf = data.buffer;
              for (let pos = 0; pos < len;) {
                  // If buffer is full and we still have input (don't process last block, same as blake2s)
                  if (this.pos === blockLen) {
                      swap32IfBE(buffer32);
                      this.compress(buffer32, 0, false);
                      swap32IfBE(buffer32);
                      this.pos = 0;
                  }
                  const take = Math.min(blockLen - this.pos, len - pos);
                  const dataOffset = offset + pos;
                  // full block && aligned to 4 bytes && not last in input
                  if (take === blockLen && !(dataOffset % 4) && pos + take < len) {
                      const data32 = new Uint32Array(buf, dataOffset, Math.floor((len - pos) / 4));
                      swap32IfBE(data32);
                      for (let pos32 = 0; pos + blockLen < len; pos32 += buffer32.length, pos += blockLen) {
                          this.length += blockLen;
                          this.compress(data32, pos32, false);
                      }
                      swap32IfBE(data32);
                      continue;
                  }
                  buffer.set(data.subarray(pos, pos + take), this.pos);
                  this.pos += take;
                  this.length += take;
                  pos += take;
              }
              return this;
          }
          digestInto(out) {
              aexists(this);
              aoutput(out, this);
              const { pos, buffer32 } = this;
              this.finished = true;
              // Padding
              clean(this.buffer.subarray(pos));
              swap32IfBE(buffer32);
              this.compress(buffer32, 0, true);
              swap32IfBE(buffer32);
              const out32 = u32(out);
              this.get().forEach((v, i) => (out32[i] = swap8IfBE(v)));
          }
          digest() {
              const { buffer, outputLen } = this;
              this.digestInto(buffer);
              const res = buffer.slice(0, outputLen);
              this.destroy();
              return res;
          }
          _cloneInto(to) {
              const { buffer, length, finished, destroyed, outputLen, pos } = this;
              to || (to = new this.constructor({ dkLen: outputLen }));
              to.set(...this.get());
              to.buffer.set(buffer);
              to.destroyed = destroyed;
              to.finished = finished;
              to.length = length;
              to.pos = pos;
              // @ts-ignore
              to.outputLen = outputLen;
              return to;
          }
          clone() {
              return this._cloneInto();
          }
      }
      class BLAKE2b extends BLAKE2 {
          constructor(opts = {}) {
              const olen = opts.dkLen === undefined ? 64 : opts.dkLen;
              super(128, olen);
              // Same as SHA-512, but LE
              this.v0l = B2B_IV[0] | 0;
              this.v0h = B2B_IV[1] | 0;
              this.v1l = B2B_IV[2] | 0;
              this.v1h = B2B_IV[3] | 0;
              this.v2l = B2B_IV[4] | 0;
              this.v2h = B2B_IV[5] | 0;
              this.v3l = B2B_IV[6] | 0;
              this.v3h = B2B_IV[7] | 0;
              this.v4l = B2B_IV[8] | 0;
              this.v4h = B2B_IV[9] | 0;
              this.v5l = B2B_IV[10] | 0;
              this.v5h = B2B_IV[11] | 0;
              this.v6l = B2B_IV[12] | 0;
              this.v6h = B2B_IV[13] | 0;
              this.v7l = B2B_IV[14] | 0;
              this.v7h = B2B_IV[15] | 0;
              checkBlake2Opts(olen, opts, 64, 16, 16);
              let { key, personalization, salt } = opts;
              let keyLength = 0;
              if (key !== undefined) {
                  key = toBytes(key);
                  keyLength = key.length;
              }
              this.v0l ^= this.outputLen | (keyLength << 8) | (0x01 << 16) | (0x01 << 24);
              if (salt !== undefined) {
                  salt = toBytes(salt);
                  const slt = u32(salt);
                  this.v4l ^= swap8IfBE(slt[0]);
                  this.v4h ^= swap8IfBE(slt[1]);
                  this.v5l ^= swap8IfBE(slt[2]);
                  this.v5h ^= swap8IfBE(slt[3]);
              }
              if (personalization !== undefined) {
                  personalization = toBytes(personalization);
                  const pers = u32(personalization);
                  this.v6l ^= swap8IfBE(pers[0]);
                  this.v6h ^= swap8IfBE(pers[1]);
                  this.v7l ^= swap8IfBE(pers[2]);
                  this.v7h ^= swap8IfBE(pers[3]);
              }
              if (key !== undefined) {
                  // Pad to blockLen and update
                  const tmp = new Uint8Array(this.blockLen);
                  tmp.set(key);
                  this.update(tmp);
              }
          }
          // prettier-ignore
          get() {
              let { v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h } = this;
              return [v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h];
          }
          // prettier-ignore
          set(v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h) {
              this.v0l = v0l | 0;
              this.v0h = v0h | 0;
              this.v1l = v1l | 0;
              this.v1h = v1h | 0;
              this.v2l = v2l | 0;
              this.v2h = v2h | 0;
              this.v3l = v3l | 0;
              this.v3h = v3h | 0;
              this.v4l = v4l | 0;
              this.v4h = v4h | 0;
              this.v5l = v5l | 0;
              this.v5h = v5h | 0;
              this.v6l = v6l | 0;
              this.v6h = v6h | 0;
              this.v7l = v7l | 0;
              this.v7h = v7h | 0;
          }
          compress(msg, offset, isLast) {
              this.get().forEach((v, i) => (BBUF[i] = v)); // First half from state.
              BBUF.set(B2B_IV, 16); // Second half from IV.
              let { h, l } = fromBig(BigInt(this.length));
              BBUF[24] = B2B_IV[8] ^ l; // Low word of the offset.
              BBUF[25] = B2B_IV[9] ^ h; // High word.
              // Invert all bits for last block
              if (isLast) {
                  BBUF[28] = ~BBUF[28];
                  BBUF[29] = ~BBUF[29];
              }
              let j = 0;
              const s = BSIGMA;
              for (let i = 0; i < 12; i++) {
                  G1b(0, 4, 8, 12, msg, offset + 2 * s[j++]);
                  G2b(0, 4, 8, 12, msg, offset + 2 * s[j++]);
                  G1b(1, 5, 9, 13, msg, offset + 2 * s[j++]);
                  G2b(1, 5, 9, 13, msg, offset + 2 * s[j++]);
                  G1b(2, 6, 10, 14, msg, offset + 2 * s[j++]);
                  G2b(2, 6, 10, 14, msg, offset + 2 * s[j++]);
                  G1b(3, 7, 11, 15, msg, offset + 2 * s[j++]);
                  G2b(3, 7, 11, 15, msg, offset + 2 * s[j++]);
                  G1b(0, 5, 10, 15, msg, offset + 2 * s[j++]);
                  G2b(0, 5, 10, 15, msg, offset + 2 * s[j++]);
                  G1b(1, 6, 11, 12, msg, offset + 2 * s[j++]);
                  G2b(1, 6, 11, 12, msg, offset + 2 * s[j++]);
                  G1b(2, 7, 8, 13, msg, offset + 2 * s[j++]);
                  G2b(2, 7, 8, 13, msg, offset + 2 * s[j++]);
                  G1b(3, 4, 9, 14, msg, offset + 2 * s[j++]);
                  G2b(3, 4, 9, 14, msg, offset + 2 * s[j++]);
              }
              this.v0l ^= BBUF[0] ^ BBUF[16];
              this.v0h ^= BBUF[1] ^ BBUF[17];
              this.v1l ^= BBUF[2] ^ BBUF[18];
              this.v1h ^= BBUF[3] ^ BBUF[19];
              this.v2l ^= BBUF[4] ^ BBUF[20];
              this.v2h ^= BBUF[5] ^ BBUF[21];
              this.v3l ^= BBUF[6] ^ BBUF[22];
              this.v3h ^= BBUF[7] ^ BBUF[23];
              this.v4l ^= BBUF[8] ^ BBUF[24];
              this.v4h ^= BBUF[9] ^ BBUF[25];
              this.v5l ^= BBUF[10] ^ BBUF[26];
              this.v5h ^= BBUF[11] ^ BBUF[27];
              this.v6l ^= BBUF[12] ^ BBUF[28];
              this.v6h ^= BBUF[13] ^ BBUF[29];
              this.v7l ^= BBUF[14] ^ BBUF[30];
              this.v7h ^= BBUF[15] ^ BBUF[31];
              clean(BBUF);
          }
          destroy() {
              this.destroyed = true;
              clean(this.buffer32);
              this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
          }
      }
      /**
       * Blake2b hash function. 64-bit. 1.5x slower than blake2s in JS.
       * @param msg - message that would be hashed
       * @param opts - dkLen output length, key for MAC mode, salt, personalization
       */
      const blake2b$1 = /* @__PURE__ */ createOptHasher((opts) => new BLAKE2b(opts));

      /**
       * Blake2b hash function. Focuses on 64-bit platforms, but in JS speed different from Blake2s is negligible.
       * @module
       * @deprecated
       */
      /** @deprecated Use import from `noble/hashes/blake2` module */
      const blake2b = blake2b$1;

      function deriveDynamicFieldID(parentId, typeTag, key) {
        const address = suiBcs.Address.serialize(parentId).toBytes();
        const tag = suiBcs.TypeTag.serialize(typeTag).toBytes();
        const keyLength = suiBcs.u64().serialize(key.length).toBytes();
        const hash = blake2b.create({
          dkLen: 32
        });
        hash.update(new Uint8Array([240]));
        hash.update(address);
        hash.update(keyLength);
        hash.update(key);
        hash.update(tag);
        return `0x${toHex(hash.digest().slice(0, 32))}`;
      }

      function deriveObjectID(parentId, typeTag, key) {
        const typeTagStr = typeof typeTag === "string" ? typeTag : TypeTagSerializer.tagToString(typeTag);
        return deriveDynamicFieldID(
          parentId,
          `0x2::derived_object::DerivedObjectKey<${typeTagStr}>`,
          key
        );
      }

      const OBJECT_MODULE_NAME = "object";
      const ID_STRUCT_NAME = "ID";
      const STD_ASCII_MODULE_NAME = "ascii";
      const STD_ASCII_STRUCT_NAME = "String";
      const STD_UTF8_MODULE_NAME = "string";
      const STD_UTF8_STRUCT_NAME = "String";
      const STD_OPTION_MODULE_NAME = "option";
      const STD_OPTION_STRUCT_NAME = "Option";
      function isTxContext(param) {
        const struct = typeof param.body === "object" && "datatype" in param.body ? param.body.datatype : null;
        return !!struct && normalizeSuiAddress(struct.package) === normalizeSuiAddress("0x2") && struct.module === "tx_context" && struct.type === "TxContext";
      }
      function getPureBcsSchema(typeSignature) {
        if (typeof typeSignature === "string") {
          switch (typeSignature) {
            case "address":
              return suiBcs.Address;
            case "bool":
              return suiBcs.Bool;
            case "u8":
              return suiBcs.U8;
            case "u16":
              return suiBcs.U16;
            case "u32":
              return suiBcs.U32;
            case "u64":
              return suiBcs.U64;
            case "u128":
              return suiBcs.U128;
            case "u256":
              return suiBcs.U256;
            default:
              throw new Error(`Unknown type signature ${typeSignature}`);
          }
        }
        if ("vector" in typeSignature) {
          if (typeSignature.vector === "u8") {
            return suiBcs.vector(suiBcs.U8).transform({
              input: (val) => typeof val === "string" ? new TextEncoder().encode(val) : val,
              output: (val) => val
            });
          }
          const type = getPureBcsSchema(typeSignature.vector);
          return type ? suiBcs.vector(type) : null;
        }
        if ("datatype" in typeSignature) {
          const pkg = normalizeSuiAddress(typeSignature.datatype.package);
          if (pkg === normalizeSuiAddress(MOVE_STDLIB_ADDRESS)) {
            if (typeSignature.datatype.module === STD_ASCII_MODULE_NAME && typeSignature.datatype.type === STD_ASCII_STRUCT_NAME) {
              return suiBcs.String;
            }
            if (typeSignature.datatype.module === STD_UTF8_MODULE_NAME && typeSignature.datatype.type === STD_UTF8_STRUCT_NAME) {
              return suiBcs.String;
            }
            if (typeSignature.datatype.module === STD_OPTION_MODULE_NAME && typeSignature.datatype.type === STD_OPTION_STRUCT_NAME) {
              const type = getPureBcsSchema(typeSignature.datatype.typeParameters[0]);
              return type ? suiBcs.vector(type) : null;
            }
          }
          if (pkg === normalizeSuiAddress(SUI_FRAMEWORK_ADDRESS) && typeSignature.datatype.module === OBJECT_MODULE_NAME && typeSignature.datatype.type === ID_STRUCT_NAME) {
            return suiBcs.Address;
          }
        }
        return null;
      }
      function normalizedTypeToMoveTypeSignature(type) {
        if (typeof type === "object" && "Reference" in type) {
          return {
            ref: "&",
            body: normalizedTypeToMoveTypeSignatureBody(type.Reference)
          };
        }
        if (typeof type === "object" && "MutableReference" in type) {
          return {
            ref: "&mut",
            body: normalizedTypeToMoveTypeSignatureBody(type.MutableReference)
          };
        }
        return {
          ref: null,
          body: normalizedTypeToMoveTypeSignatureBody(type)
        };
      }
      function normalizedTypeToMoveTypeSignatureBody(type) {
        if (typeof type === "string") {
          switch (type) {
            case "Address":
              return "address";
            case "Bool":
              return "bool";
            case "U8":
              return "u8";
            case "U16":
              return "u16";
            case "U32":
              return "u32";
            case "U64":
              return "u64";
            case "U128":
              return "u128";
            case "U256":
              return "u256";
            default:
              throw new Error(`Unexpected type ${type}`);
          }
        }
        if ("Vector" in type) {
          return { vector: normalizedTypeToMoveTypeSignatureBody(type.Vector) };
        }
        if ("Struct" in type) {
          return {
            datatype: {
              package: type.Struct.address,
              module: type.Struct.module,
              type: type.Struct.name,
              typeParameters: type.Struct.typeArguments.map(normalizedTypeToMoveTypeSignatureBody)
            }
          };
        }
        if ("TypeParameter" in type) {
          return { typeParameter: type.TypeParameter };
        }
        throw new Error(`Unexpected type ${JSON.stringify(type)}`);
      }

      const MAX_OBJECTS_PER_FETCH = 50;
      const GAS_SAFE_OVERHEAD = 1000n;
      const MAX_GAS = 5e10;
      function jsonRpcClientResolveTransactionPlugin(client) {
        return async function resolveTransactionData(transactionData, options, next) {
          await normalizeInputs(transactionData, client);
          await resolveObjectReferences(transactionData, client);
          if (!options.onlyTransactionKind) {
            await setGasPrice(transactionData, client);
            await setGasBudget(transactionData, client);
            await setGasPayment(transactionData, client);
          }
          return await next();
        };
      }
      async function setGasPrice(transactionData, client) {
        if (!transactionData.gasConfig.price) {
          transactionData.gasConfig.price = String(await client.getReferenceGasPrice());
        }
      }
      async function setGasBudget(transactionData, client) {
        if (transactionData.gasConfig.budget) {
          return;
        }
        const dryRunResult = await client.dryRunTransactionBlock({
          transactionBlock: transactionData.build({
            overrides: {
              gasData: {
                budget: String(MAX_GAS),
                payment: []
              }
            }
          })
        });
        if (dryRunResult.effects.status.status !== "success") {
          throw new Error(
            `Dry run failed, could not automatically determine a budget: ${dryRunResult.effects.status.error}`,
            { cause: dryRunResult }
          );
        }
        const safeOverhead = GAS_SAFE_OVERHEAD * BigInt(transactionData.gasConfig.price || 1n);
        const baseComputationCostWithOverhead = BigInt(dryRunResult.effects.gasUsed.computationCost) + safeOverhead;
        const gasBudget = baseComputationCostWithOverhead + BigInt(dryRunResult.effects.gasUsed.storageCost) - BigInt(dryRunResult.effects.gasUsed.storageRebate);
        transactionData.gasConfig.budget = String(
          gasBudget > baseComputationCostWithOverhead ? gasBudget : baseComputationCostWithOverhead
        );
      }
      async function setGasPayment(transactionData, client) {
        if (!transactionData.gasConfig.payment) {
          const coins = await client.getCoins({
            owner: transactionData.gasConfig.owner || transactionData.sender,
            coinType: SUI_TYPE_ARG
          });
          const paymentCoins = coins.data.filter((coin) => {
            const matchingInput = transactionData.inputs.find((input) => {
              if (input.Object?.ImmOrOwnedObject) {
                return coin.coinObjectId === input.Object.ImmOrOwnedObject.objectId;
              }
              return false;
            });
            return !matchingInput;
          }).map((coin) => ({
            objectId: coin.coinObjectId,
            digest: coin.digest,
            version: coin.version
          }));
          if (!paymentCoins.length) {
            throw new Error("No valid gas coins found for the transaction.");
          }
          transactionData.gasConfig.payment = paymentCoins.map(
            (payment) => parse(ObjectRefSchema, payment)
          );
        }
      }
      async function resolveObjectReferences(transactionData, client) {
        const objectsToResolve = transactionData.inputs.filter((input) => {
          return input.UnresolvedObject && !(input.UnresolvedObject.version || input.UnresolvedObject?.initialSharedVersion);
        });
        const dedupedIds = [
          ...new Set(
            objectsToResolve.map((input) => normalizeSuiObjectId(input.UnresolvedObject.objectId))
          )
        ];
        const objectChunks = dedupedIds.length ? chunk(dedupedIds, MAX_OBJECTS_PER_FETCH) : [];
        const resolved = (await Promise.all(
          objectChunks.map(
            (chunk2) => client.multiGetObjects({
              ids: chunk2,
              options: { showOwner: true }
            })
          )
        )).flat();
        const responsesById = new Map(
          dedupedIds.map((id, index) => {
            return [id, resolved[index]];
          })
        );
        const invalidObjects = Array.from(responsesById).filter(([_, obj]) => obj.error).map(([_, obj]) => JSON.stringify(obj.error));
        if (invalidObjects.length) {
          throw new Error(`The following input objects are invalid: ${invalidObjects.join(", ")}`);
        }
        const objects = resolved.map((object) => {
          if (object.error || !object.data) {
            throw new Error(`Failed to fetch object: ${object.error}`);
          }
          const owner = object.data.owner;
          const initialSharedVersion = owner && typeof owner === "object" ? "Shared" in owner ? owner.Shared.initial_shared_version : "ConsensusAddressOwner" in owner ? owner.ConsensusAddressOwner.start_version : null : null;
          return {
            objectId: object.data.objectId,
            digest: object.data.digest,
            version: object.data.version,
            initialSharedVersion
          };
        });
        const objectsById = new Map(
          dedupedIds.map((id, index) => {
            return [id, objects[index]];
          })
        );
        for (const [index, input] of transactionData.inputs.entries()) {
          if (!input.UnresolvedObject) {
            continue;
          }
          let updated;
          const id = normalizeSuiAddress(input.UnresolvedObject.objectId);
          const object = objectsById.get(id);
          if (input.UnresolvedObject.initialSharedVersion ?? object?.initialSharedVersion) {
            updated = Inputs.SharedObjectRef({
              objectId: id,
              initialSharedVersion: input.UnresolvedObject.initialSharedVersion || object?.initialSharedVersion,
              mutable: input.UnresolvedObject.mutable || isUsedAsMutable(transactionData, index)
            });
          } else if (isUsedAsReceiving(transactionData, index)) {
            updated = Inputs.ReceivingRef(
              {
                objectId: id,
                digest: input.UnresolvedObject.digest ?? object?.digest,
                version: input.UnresolvedObject.version ?? object?.version
              }
            );
          }
          transactionData.inputs[transactionData.inputs.indexOf(input)] = updated ?? Inputs.ObjectRef({
            objectId: id,
            digest: input.UnresolvedObject.digest ?? object?.digest,
            version: input.UnresolvedObject.version ?? object?.version
          });
        }
      }
      async function normalizeInputs(transactionData, client) {
        const { inputs, commands } = transactionData;
        const moveCallsToResolve = [];
        const moveFunctionsToResolve = /* @__PURE__ */ new Set();
        commands.forEach((command) => {
          if (command.MoveCall) {
            if (command.MoveCall._argumentTypes) {
              return;
            }
            const inputs2 = command.MoveCall.arguments.map((arg) => {
              if (arg.$kind === "Input") {
                return transactionData.inputs[arg.Input];
              }
              return null;
            });
            const needsResolution = inputs2.some(
              (input) => input?.UnresolvedPure || input?.UnresolvedObject && typeof input?.UnresolvedObject.mutable !== "boolean"
            );
            if (needsResolution) {
              const functionName = `${command.MoveCall.package}::${command.MoveCall.module}::${command.MoveCall.function}`;
              moveFunctionsToResolve.add(functionName);
              moveCallsToResolve.push(command.MoveCall);
            }
          }
        });
        const moveFunctionParameters = /* @__PURE__ */ new Map();
        if (moveFunctionsToResolve.size > 0) {
          await Promise.all(
            [...moveFunctionsToResolve].map(async (functionName) => {
              const [packageId, moduleId, functionId] = functionName.split("::");
              const def = await client.getNormalizedMoveFunction({
                package: packageId,
                module: moduleId,
                function: functionId
              });
              moveFunctionParameters.set(
                functionName,
                def.parameters.map((param) => normalizedTypeToMoveTypeSignature(param))
              );
            })
          );
        }
        if (moveCallsToResolve.length) {
          await Promise.all(
            moveCallsToResolve.map(async (moveCall) => {
              const parameters = moveFunctionParameters.get(
                `${moveCall.package}::${moveCall.module}::${moveCall.function}`
              );
              if (!parameters) {
                return;
              }
              const hasTxContext = parameters.length > 0 && isTxContext(parameters.at(-1));
              const params = hasTxContext ? parameters.slice(0, parameters.length - 1) : parameters;
              moveCall._argumentTypes = params;
            })
          );
        }
        commands.forEach((command) => {
          if (!command.MoveCall) {
            return;
          }
          const moveCall = command.MoveCall;
          const fnName = `${moveCall.package}::${moveCall.module}::${moveCall.function}`;
          const params = moveCall._argumentTypes;
          if (!params) {
            return;
          }
          if (params.length !== command.MoveCall.arguments.length) {
            throw new Error(`Incorrect number of arguments for ${fnName}`);
          }
          params.forEach((param, i) => {
            const arg = moveCall.arguments[i];
            if (arg.$kind !== "Input") return;
            const input = inputs[arg.Input];
            if (!input.UnresolvedPure && !input.UnresolvedObject) {
              return;
            }
            const inputValue = input.UnresolvedPure?.value ?? input.UnresolvedObject?.objectId;
            const schema = getPureBcsSchema(param.body);
            if (schema) {
              arg.type = "pure";
              inputs[inputs.indexOf(input)] = Inputs.Pure(schema.serialize(inputValue));
              return;
            }
            if (typeof inputValue !== "string") {
              throw new Error(
                `Expect the argument to be an object id string, got ${JSON.stringify(
            inputValue,
            null,
            2
          )}`
              );
            }
            arg.type = "object";
            const unresolvedObject = input.UnresolvedPure ? {
              $kind: "UnresolvedObject",
              UnresolvedObject: {
                objectId: inputValue
              }
            } : input;
            inputs[arg.Input] = unresolvedObject;
          });
        });
      }
      function isUsedAsMutable(transactionData, index) {
        let usedAsMutable = false;
        transactionData.getInputUses(index, (arg, tx) => {
          if (tx.MoveCall && tx.MoveCall._argumentTypes) {
            const argIndex = tx.MoveCall.arguments.indexOf(arg);
            usedAsMutable = tx.MoveCall._argumentTypes[argIndex].ref !== "&" || usedAsMutable;
          }
          if (tx.$kind === "MakeMoveVec" || tx.$kind === "MergeCoins" || tx.$kind === "SplitCoins" || tx.$kind === "TransferObjects") {
            usedAsMutable = true;
          }
        });
        return usedAsMutable;
      }
      function isUsedAsReceiving(transactionData, index) {
        let usedAsReceiving = false;
        transactionData.getInputUses(index, (arg, tx) => {
          if (tx.MoveCall && tx.MoveCall._argumentTypes) {
            const argIndex = tx.MoveCall.arguments.indexOf(arg);
            usedAsReceiving = isReceivingType(tx.MoveCall._argumentTypes[argIndex]) || usedAsReceiving;
          }
        });
        return usedAsReceiving;
      }
      function isReceivingType(type) {
        if (typeof type.body !== "object" || !("datatype" in type.body)) {
          return false;
        }
        return type.body.datatype.package === "0x2" && type.body.datatype.module === "transfer" && type.body.datatype.type === "Receiving";
      }

      function needsTransactionResolution(data, options) {
        if (data.inputs.some((input) => {
          return input.UnresolvedObject || input.UnresolvedPure;
        })) {
          return true;
        }
        if (!options.onlyTransactionKind) {
          if (!data.gasConfig.price || !data.gasConfig.budget || !data.gasConfig.payment) {
            return true;
          }
        }
        return false;
      }
      async function resolveTransactionPlugin(transactionData, options, next) {
        normalizeRawArguments(transactionData);
        if (!needsTransactionResolution(transactionData, options)) {
          await validate(transactionData);
          return next();
        }
        const client = getClient$1(options);
        const plugin = client.core?.resolveTransactionPlugin() ?? jsonRpcClientResolveTransactionPlugin(client);
        return plugin(transactionData, options, async () => {
          await validate(transactionData);
          await next();
        });
      }
      function validate(transactionData) {
        transactionData.inputs.forEach((input, index) => {
          if (input.$kind !== "Object" && input.$kind !== "Pure") {
            throw new Error(
              `Input at index ${index} has not been resolved.  Expected a Pure or Object input, but found ${JSON.stringify(
          input
        )}`
            );
          }
        });
      }
      function getClient$1(options) {
        if (!options.client) {
          throw new Error(
            `No sui client passed to Transaction#build, but transaction data was not sufficient to build offline.`
          );
        }
        return options.client;
      }
      function normalizeRawArguments(transactionData) {
        for (const command of transactionData.commands) {
          switch (command.$kind) {
            case "SplitCoins":
              command.SplitCoins.amounts.forEach((amount) => {
                normalizeRawArgument(amount, suiBcs.U64, transactionData);
              });
              break;
            case "TransferObjects":
              normalizeRawArgument(command.TransferObjects.address, suiBcs.Address, transactionData);
              break;
          }
        }
      }
      function normalizeRawArgument(arg, schema, transactionData) {
        if (arg.$kind !== "Input") {
          return;
        }
        const input = transactionData.inputs[arg.Input];
        if (input.$kind !== "UnresolvedPure") {
          return;
        }
        transactionData.inputs[arg.Input] = Inputs.Pure(schema.serialize(input.UnresolvedPure.value));
      }

      function createObjectMethods(makeObject) {
        function object(value) {
          return makeObject(value);
        }
        object.system = (options) => {
          const mutable = options?.mutable;
          if (mutable !== void 0) {
            return object(
              Inputs.SharedObjectRef({
                objectId: "0x5",
                initialSharedVersion: 1,
                mutable
              })
            );
          }
          return object({
            $kind: "UnresolvedObject",
            UnresolvedObject: {
              objectId: "0x5",
              initialSharedVersion: 1
            }
          });
        };
        object.clock = () => object(
          Inputs.SharedObjectRef({
            objectId: "0x6",
            initialSharedVersion: 1,
            mutable: false
          })
        );
        object.random = () => object({
          $kind: "UnresolvedObject",
          UnresolvedObject: {
            objectId: "0x8",
            mutable: false
          }
        });
        object.denyList = (options) => {
          return object({
            $kind: "UnresolvedObject",
            UnresolvedObject: {
              objectId: "0x403",
              mutable: options?.mutable
            }
          });
        };
        object.option = ({ type, value }) => (tx) => tx.moveCall({
          typeArguments: [type],
          target: `0x1::option::${value === null ? "none" : "some"}`,
          arguments: value === null ? [] : [tx.object(value)]
        });
        return object;
      }

      function createPure(makePure) {
        function pure(typeOrSerializedValue, value) {
          if (typeof typeOrSerializedValue === "string") {
            return makePure(pureBcsSchemaFromTypeName(typeOrSerializedValue).serialize(value));
          }
          if (typeOrSerializedValue instanceof Uint8Array || isSerializedBcs(typeOrSerializedValue)) {
            return makePure(typeOrSerializedValue);
          }
          throw new Error("tx.pure must be called either a bcs type name, or a serialized bcs value");
        }
        pure.u8 = (value) => makePure(suiBcs.U8.serialize(value));
        pure.u16 = (value) => makePure(suiBcs.U16.serialize(value));
        pure.u32 = (value) => makePure(suiBcs.U32.serialize(value));
        pure.u64 = (value) => makePure(suiBcs.U64.serialize(value));
        pure.u128 = (value) => makePure(suiBcs.U128.serialize(value));
        pure.u256 = (value) => makePure(suiBcs.U256.serialize(value));
        pure.bool = (value) => makePure(suiBcs.Bool.serialize(value));
        pure.string = (value) => makePure(suiBcs.String.serialize(value));
        pure.address = (value) => makePure(suiBcs.Address.serialize(value));
        pure.id = pure.address;
        pure.vector = (type, value) => {
          return makePure(
            suiBcs.vector(pureBcsSchemaFromTypeName(type)).serialize(value)
          );
        };
        pure.option = (type, value) => {
          return makePure(suiBcs.option(pureBcsSchemaFromTypeName(type)).serialize(value));
        };
        return pure;
      }

      function hashTypedData(typeTag, data) {
        const typeTagBytes = Array.from(`${typeTag}::`).map((e) => e.charCodeAt(0));
        const dataWithTag = new Uint8Array(typeTagBytes.length + data.length);
        dataWithTag.set(typeTagBytes);
        dataWithTag.set(data, typeTagBytes.length);
        return blake2b(dataWithTag, { dkLen: 32 });
      }

      function prepareSuiAddress(address) {
        return normalizeSuiAddress(address).replace("0x", "");
      }
      class TransactionDataBuilder {
        constructor(clone) {
          this.version = 2;
          this.sender = clone?.sender ?? null;
          this.expiration = clone?.expiration ?? null;
          this.inputs = clone?.inputs ?? [];
          this.commands = clone?.commands ?? [];
          this.gasData = clone?.gasData ?? {
            budget: null,
            price: null,
            owner: null,
            payment: null
          };
        }
        static fromKindBytes(bytes) {
          const kind = suiBcs.TransactionKind.parse(bytes);
          const programmableTx = kind.ProgrammableTransaction;
          if (!programmableTx) {
            throw new Error("Unable to deserialize from bytes.");
          }
          return TransactionDataBuilder.restore({
            version: 2,
            sender: null,
            expiration: null,
            gasData: {
              budget: null,
              owner: null,
              payment: null,
              price: null
            },
            inputs: programmableTx.inputs,
            commands: programmableTx.commands
          });
        }
        static fromBytes(bytes) {
          const rawData = suiBcs.TransactionData.parse(bytes);
          const data = rawData?.V1;
          const programmableTx = data.kind.ProgrammableTransaction;
          if (!data || !programmableTx) {
            throw new Error("Unable to deserialize from bytes.");
          }
          return TransactionDataBuilder.restore({
            version: 2,
            sender: data.sender,
            expiration: data.expiration,
            gasData: data.gasData,
            inputs: programmableTx.inputs,
            commands: programmableTx.commands
          });
        }
        static restore(data) {
          if (data.version === 2) {
            return new TransactionDataBuilder(parse(TransactionDataSchema, data));
          } else {
            return new TransactionDataBuilder(parse(TransactionDataSchema, transactionDataFromV1(data)));
          }
        }
        /**
         * Generate transaction digest.
         *
         * @param bytes BCS serialized transaction data
         * @returns transaction digest.
         */
        static getDigestFromBytes(bytes) {
          const hash = hashTypedData("TransactionData", bytes);
          return toBase58(hash);
        }
        // @deprecated use gasData instead
        get gasConfig() {
          return this.gasData;
        }
        // @deprecated use gasData instead
        set gasConfig(value) {
          this.gasData = value;
        }
        build({
          maxSizeBytes = Infinity,
          overrides,
          onlyTransactionKind
        } = {}) {
          const inputs = this.inputs;
          const commands = this.commands;
          const kind = {
            ProgrammableTransaction: {
              inputs,
              commands
            }
          };
          if (onlyTransactionKind) {
            return suiBcs.TransactionKind.serialize(kind, { maxSize: maxSizeBytes }).toBytes();
          }
          const expiration = overrides?.expiration ?? this.expiration;
          const sender = overrides?.sender ?? this.sender;
          const gasData = { ...this.gasData, ...overrides?.gasConfig, ...overrides?.gasData };
          if (!sender) {
            throw new Error("Missing transaction sender");
          }
          if (!gasData.budget) {
            throw new Error("Missing gas budget");
          }
          if (!gasData.payment) {
            throw new Error("Missing gas payment");
          }
          if (!gasData.price) {
            throw new Error("Missing gas price");
          }
          const transactionData = {
            sender: prepareSuiAddress(sender),
            expiration: expiration ? expiration : { None: true },
            gasData: {
              payment: gasData.payment,
              owner: prepareSuiAddress(this.gasData.owner ?? sender),
              price: BigInt(gasData.price),
              budget: BigInt(gasData.budget)
            },
            kind: {
              ProgrammableTransaction: {
                inputs,
                commands
              }
            }
          };
          return suiBcs.TransactionData.serialize(
            { V1: transactionData },
            { maxSize: maxSizeBytes }
          ).toBytes();
        }
        addInput(type, arg) {
          const index = this.inputs.length;
          this.inputs.push(arg);
          return { Input: index, type, $kind: "Input" };
        }
        getInputUses(index, fn) {
          this.mapArguments((arg, command) => {
            if (arg.$kind === "Input" && arg.Input === index) {
              fn(arg, command);
            }
            return arg;
          });
        }
        mapCommandArguments(index, fn) {
          const command = this.commands[index];
          switch (command.$kind) {
            case "MoveCall":
              command.MoveCall.arguments = command.MoveCall.arguments.map(
                (arg) => fn(arg, command, index)
              );
              break;
            case "TransferObjects":
              command.TransferObjects.objects = command.TransferObjects.objects.map(
                (arg) => fn(arg, command, index)
              );
              command.TransferObjects.address = fn(command.TransferObjects.address, command, index);
              break;
            case "SplitCoins":
              command.SplitCoins.coin = fn(command.SplitCoins.coin, command, index);
              command.SplitCoins.amounts = command.SplitCoins.amounts.map(
                (arg) => fn(arg, command, index)
              );
              break;
            case "MergeCoins":
              command.MergeCoins.destination = fn(command.MergeCoins.destination, command, index);
              command.MergeCoins.sources = command.MergeCoins.sources.map(
                (arg) => fn(arg, command, index)
              );
              break;
            case "MakeMoveVec":
              command.MakeMoveVec.elements = command.MakeMoveVec.elements.map(
                (arg) => fn(arg, command, index)
              );
              break;
            case "Upgrade":
              command.Upgrade.ticket = fn(command.Upgrade.ticket, command, index);
              break;
            case "$Intent":
              const inputs = command.$Intent.inputs;
              command.$Intent.inputs = {};
              for (const [key, value] of Object.entries(inputs)) {
                command.$Intent.inputs[key] = Array.isArray(value) ? value.map((arg) => fn(arg, command, index)) : fn(value, command, index);
              }
              break;
            case "Publish":
              break;
            default:
              throw new Error(`Unexpected transaction kind: ${command.$kind}`);
          }
        }
        mapArguments(fn) {
          for (const commandIndex of this.commands.keys()) {
            this.mapCommandArguments(commandIndex, fn);
          }
        }
        replaceCommand(index, replacement, resultIndex = index) {
          if (!Array.isArray(replacement)) {
            this.commands[index] = replacement;
            return;
          }
          const sizeDiff = replacement.length - 1;
          this.commands.splice(index, 1, ...replacement);
          if (sizeDiff !== 0) {
            this.mapArguments((arg, _command, commandIndex) => {
              if (commandIndex < index + replacement.length) {
                return arg;
              }
              switch (arg.$kind) {
                case "Result":
                  if (arg.Result === index) {
                    arg.Result = resultIndex;
                  }
                  if (arg.Result > index) {
                    arg.Result += sizeDiff;
                  }
                  break;
                case "NestedResult":
                  if (arg.NestedResult[0] === index) {
                    arg.NestedResult[0] = resultIndex;
                  }
                  if (arg.NestedResult[0] > index) {
                    arg.NestedResult[0] += sizeDiff;
                  }
                  break;
              }
              return arg;
            });
          }
        }
        getDigest() {
          const bytes = this.build({ onlyTransactionKind: false });
          return TransactionDataBuilder.getDigestFromBytes(bytes);
        }
        snapshot() {
          return parse(TransactionDataSchema, this);
        }
        shallowClone() {
          return new TransactionDataBuilder({
            version: this.version,
            sender: this.sender,
            expiration: this.expiration,
            gasData: {
              ...this.gasData
            },
            inputs: [...this.inputs],
            commands: [...this.commands]
          });
        }
      } exports("TransactionDataBuilder", TransactionDataBuilder);

      function getIdFromCallArg(arg) {
        if (typeof arg === "string") {
          return normalizeSuiAddress(arg);
        }
        if (arg.Object) {
          if (arg.Object.ImmOrOwnedObject) {
            return normalizeSuiAddress(arg.Object.ImmOrOwnedObject.objectId);
          }
          if (arg.Object.Receiving) {
            return normalizeSuiAddress(arg.Object.Receiving.objectId);
          }
          return normalizeSuiAddress(arg.Object.SharedObject.objectId);
        }
        if (arg.UnresolvedObject) {
          return normalizeSuiAddress(arg.UnresolvedObject.objectId);
        }
        return void 0;
      }
      function isArgument(value) {
        return is(ArgumentSchema, value);
      }

      var __typeError$7 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$7 = (obj, member, msg) => member.has(obj) || __typeError$7("Cannot " + msg);
      var __privateGet$7 = (obj, member, getter) => (__accessCheck$7(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$7 = (obj, member, value) => member.has(obj) ? __typeError$7("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$6 = (obj, member, value, setter) => (__accessCheck$7(obj, member, "write to private field"), member.set(obj, value), value);
      var __privateMethod$2 = (obj, member, method) => (__accessCheck$7(obj, member, "access private method"), method);
      var _cache$3, _url, _pageSize, _overrides, _MvrClient_instances, mvrPackageDataLoader_get, mvrTypeDataLoader_get, resolvePackages_fn, resolveTypes_fn, fetch_fn;
      const NAME_SEPARATOR = "/";
      const MVR_API_HEADER = {
        "Mvr-Source": `@mysten/sui@${PACKAGE_VERSION}`
      };
      class MvrClient {
        constructor({ cache, url, pageSize = 50, overrides }) {
          __privateAdd$7(this, _MvrClient_instances);
          __privateAdd$7(this, _cache$3);
          __privateAdd$7(this, _url);
          __privateAdd$7(this, _pageSize);
          __privateAdd$7(this, _overrides);
          __privateSet$6(this, _cache$3, cache);
          __privateSet$6(this, _url, url);
          __privateSet$6(this, _pageSize, pageSize);
          __privateSet$6(this, _overrides, {
            packages: overrides?.packages,
            types: overrides?.types
          });
          validateOverrides(__privateGet$7(this, _overrides));
        }
        async resolvePackage({
          package: name
        }) {
          if (!hasMvrName(name)) {
            return {
              package: name
            };
          }
          const resolved = await __privateGet$7(this, _MvrClient_instances, mvrPackageDataLoader_get).load(name);
          return {
            package: resolved
          };
        }
        async resolveType({
          type
        }) {
          if (!hasMvrName(type)) {
            return {
              type
            };
          }
          const mvrTypes = [...extractMvrTypes(type)];
          const resolvedTypes = await __privateGet$7(this, _MvrClient_instances, mvrTypeDataLoader_get).loadMany(mvrTypes);
          const typeMap = {};
          for (let i = 0; i < mvrTypes.length; i++) {
            const resolvedType = resolvedTypes[i];
            if (resolvedType instanceof Error) {
              throw resolvedType;
            }
            typeMap[mvrTypes[i]] = resolvedType;
          }
          return {
            type: replaceMvrNames(type, typeMap)
          };
        }
        async resolve({
          types = [],
          packages = []
        }) {
          const mvrTypes = /* @__PURE__ */ new Set();
          for (const type of types ?? []) {
            extractMvrTypes(type, mvrTypes);
          }
          const typesArray = [...mvrTypes];
          const [resolvedTypes, resolvedPackages] = await Promise.all([
            typesArray.length > 0 ? __privateGet$7(this, _MvrClient_instances, mvrTypeDataLoader_get).loadMany(typesArray) : [],
            packages.length > 0 ? __privateGet$7(this, _MvrClient_instances, mvrPackageDataLoader_get).loadMany(packages) : []
          ]);
          const typeMap = {
            ...__privateGet$7(this, _overrides)?.types
          };
          for (const [i, type] of typesArray.entries()) {
            const resolvedType = resolvedTypes[i];
            if (resolvedType instanceof Error) {
              throw resolvedType;
            }
            typeMap[type] = resolvedType;
          }
          const replacedTypes = {};
          for (const type of types ?? []) {
            const resolvedType = replaceMvrNames(type, typeMap);
            replacedTypes[type] = {
              type: resolvedType
            };
          }
          const replacedPackages = {};
          for (const [i, pkg] of (packages ?? []).entries()) {
            const resolvedPkg = __privateGet$7(this, _overrides)?.packages?.[pkg] ?? resolvedPackages[i];
            if (resolvedPkg instanceof Error) {
              throw resolvedPkg;
            }
            replacedPackages[pkg] = {
              package: resolvedPkg
            };
          }
          return {
            types: replacedTypes,
            packages: replacedPackages
          };
        }
      }
      _cache$3 = new WeakMap();
      _url = new WeakMap();
      _pageSize = new WeakMap();
      _overrides = new WeakMap();
      _MvrClient_instances = new WeakSet();
      mvrPackageDataLoader_get = function() {
        return __privateGet$7(this, _cache$3).readSync(["#mvrPackageDataLoader", __privateGet$7(this, _url) ?? ""], () => {
          const loader = new DataLoader(async (packages) => {
            if (!__privateGet$7(this, _url)) {
              throw new Error(
                `MVR Api URL is not set for the current client (resolving ${packages.join(", ")})`
              );
            }
            const resolved = await __privateMethod$2(this, _MvrClient_instances, resolvePackages_fn).call(this, packages);
            return packages.map(
              (pkg) => resolved[pkg] ?? new Error(`Failed to resolve package: ${pkg}`)
            );
          });
          const overrides = __privateGet$7(this, _overrides)?.packages;
          if (overrides) {
            for (const [pkg, id] of Object.entries(overrides)) {
              loader.prime(pkg, id);
            }
          }
          return loader;
        });
      };
      mvrTypeDataLoader_get = function() {
        return __privateGet$7(this, _cache$3).readSync(["#mvrTypeDataLoader", __privateGet$7(this, _url) ?? ""], () => {
          const loader = new DataLoader(async (types) => {
            if (!__privateGet$7(this, _url)) {
              throw new Error(
                `MVR Api URL is not set for the current client (resolving ${types.join(", ")})`
              );
            }
            const resolved = await __privateMethod$2(this, _MvrClient_instances, resolveTypes_fn).call(this, types);
            return types.map((type) => resolved[type] ?? new Error(`Failed to resolve type: ${type}`));
          });
          const overrides = __privateGet$7(this, _overrides)?.types;
          if (overrides) {
            for (const [type, id] of Object.entries(overrides)) {
              loader.prime(type, id);
            }
          }
          return loader;
        });
      };
      resolvePackages_fn = async function(packages) {
        if (packages.length === 0) return {};
        const batches = chunk(packages, __privateGet$7(this, _pageSize));
        const results = {};
        await Promise.all(
          batches.map(async (batch) => {
            const data = await __privateMethod$2(this, _MvrClient_instances, fetch_fn).call(this, "/v1/resolution/bulk", {
              names: batch
            });
            if (!data?.resolution) return;
            for (const pkg of Object.keys(data?.resolution)) {
              const pkgData = data.resolution[pkg]?.package_id;
              if (!pkgData) continue;
              results[pkg] = pkgData;
            }
          })
        );
        return results;
      };
      resolveTypes_fn = async function(types) {
        if (types.length === 0) return {};
        const batches = chunk(types, __privateGet$7(this, _pageSize));
        const results = {};
        await Promise.all(
          batches.map(async (batch) => {
            const data = await __privateMethod$2(this, _MvrClient_instances, fetch_fn).call(this, "/v1/struct-definition/bulk", {
              types: batch
            });
            if (!data?.resolution) return;
            for (const type of Object.keys(data?.resolution)) {
              const typeData = data.resolution[type]?.type_tag;
              if (!typeData) continue;
              results[type] = typeData;
            }
          })
        );
        return results;
      };
      fetch_fn = async function(url, body) {
        if (!__privateGet$7(this, _url)) {
          throw new Error("MVR Api URL is not set for the current client");
        }
        const response = await fetch(`${__privateGet$7(this, _url)}${url}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...MVR_API_HEADER
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`Failed to resolve types: ${errorBody?.message}`);
        }
        return response.json();
      };
      function validateOverrides(overrides) {
        if (overrides?.packages) {
          for (const [pkg, id] of Object.entries(overrides.packages)) {
            if (!isValidNamedPackage(pkg)) {
              throw new Error(`Invalid package name: ${pkg}`);
            }
            if (!isValidSuiAddress(normalizeSuiAddress(id))) {
              throw new Error(`Invalid package ID: ${id}`);
            }
          }
        }
        if (overrides?.types) {
          for (const [type, val] of Object.entries(overrides.types)) {
            if (parseStructTag(type).typeParams.length > 0) {
              throw new Error(
                "Type overrides must be first-level only. If you want to supply generic types, just pass each type individually."
              );
            }
            const parsedValue = parseStructTag(val);
            if (!isValidSuiAddress(parsedValue.address)) {
              throw new Error(`Invalid type: ${val}`);
            }
          }
        }
      }
      function extractMvrTypes(type, types = /* @__PURE__ */ new Set()) {
        if (typeof type === "string" && !hasMvrName(type)) return types;
        const tag = isStructTag(type) ? type : parseStructTag(type);
        if (hasMvrName(tag.address)) types.add(`${tag.address}::${tag.module}::${tag.name}`);
        for (const param of tag.typeParams) {
          extractMvrTypes(param, types);
        }
        return types;
      }
      function replaceMvrNames(tag, typeCache) {
        const type = isStructTag(tag) ? tag : parseStructTag(tag);
        const typeTag = `${type.address}::${type.module}::${type.name}`;
        const cacheHit = typeCache[typeTag];
        return normalizeStructTag({
          ...type,
          address: cacheHit ? cacheHit.split("::")[0] : type.address,
          typeParams: type.typeParams.map((param) => replaceMvrNames(param, typeCache))
        });
      }
      function hasMvrName(nameOrType) {
        return nameOrType.includes(NAME_SEPARATOR) || nameOrType.includes("@") || nameOrType.includes(".sui");
      }
      function isStructTag(type) {
        return typeof type === "object" && "address" in type && "module" in type && "name" in type && "typeParams" in type;
      }
      function findNamesInTransaction(builder) {
        const packages = /* @__PURE__ */ new Set();
        const types = /* @__PURE__ */ new Set();
        for (const command of builder.commands) {
          switch (command.$kind) {
            case "MakeMoveVec":
              if (command.MakeMoveVec.type) {
                getNamesFromTypeList([command.MakeMoveVec.type]).forEach((type) => {
                  types.add(type);
                });
              }
              break;
            case "MoveCall":
              const moveCall = command.MoveCall;
              const pkg = moveCall.package.split("::")[0];
              if (hasMvrName(pkg)) {
                if (!isValidNamedPackage(pkg)) throw new Error(`Invalid package name: ${pkg}`);
                packages.add(pkg);
              }
              getNamesFromTypeList(moveCall.typeArguments ?? []).forEach((type) => {
                types.add(type);
              });
              break;
          }
        }
        return {
          packages: [...packages],
          types: [...types]
        };
      }
      function replaceNames(builder, resolved) {
        for (const command of builder.commands) {
          if (command.MakeMoveVec?.type) {
            if (!hasMvrName(command.MakeMoveVec.type)) continue;
            if (!resolved.types[command.MakeMoveVec.type])
              throw new Error(`No resolution found for type: ${command.MakeMoveVec.type}`);
            command.MakeMoveVec.type = resolved.types[command.MakeMoveVec.type].type;
          }
          const tx = command.MoveCall;
          if (!tx) continue;
          const nameParts = tx.package.split("::");
          const name = nameParts[0];
          if (hasMvrName(name) && !resolved.packages[name])
            throw new Error(`No address found for package: ${name}`);
          if (hasMvrName(name)) {
            nameParts[0] = resolved.packages[name].package;
            tx.package = nameParts.join("::");
          }
          const types = tx.typeArguments;
          if (!types) continue;
          for (let i = 0; i < types.length; i++) {
            if (!hasMvrName(types[i])) continue;
            if (!resolved.types[types[i]]) throw new Error(`No resolution found for type: ${types[i]}`);
            types[i] = resolved.types[types[i]].type;
          }
          tx.typeArguments = types;
        }
      }
      function getNamesFromTypeList(types) {
        const names = /* @__PURE__ */ new Set();
        for (const type of types) {
          if (hasMvrName(type)) {
            if (!isValidNamedType(type)) throw new Error(`Invalid type with names: ${type}`);
            names.add(type);
          }
        }
        return names;
      }

      const cacheMap = /* @__PURE__ */ new WeakMap();
      const namedPackagesPlugin = exports("namedPackagesPlugin", (options) => {
        let mvrClient;
        if (options) {
          const overrides = options.overrides ?? {
            packages: {},
            types: {}
          };
          if (!cacheMap.has(overrides)) {
            cacheMap.set(overrides, new ClientCache());
          }
          mvrClient = new MvrClient({
            cache: cacheMap.get(overrides),
            url: options.url,
            pageSize: options.pageSize,
            overrides
          });
        }
        return async (transactionData, buildOptions, next) => {
          const names = findNamesInTransaction(transactionData);
          if (names.types.length === 0 && names.packages.length === 0) {
            return next();
          }
          const resolved = await (mvrClient || getClient(buildOptions).core.mvr).resolve({
            types: names.types,
            packages: names.packages
          });
          replaceNames(transactionData, resolved);
          await next();
        };
      });
      function getClient(options) {
        if (!options.client) {
          throw new Error(
            `No sui client passed to Transaction#build, but transaction data was not sufficient to build offline.`
          );
        }
        return options.client;
      }

      var __typeError$6 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$6 = (obj, member, msg) => member.has(obj) || __typeError$6("Cannot " + msg);
      var __privateGet$6 = (obj, member, getter) => (__accessCheck$6(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$6 = (obj, member, value) => member.has(obj) ? __typeError$6("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$5 = (obj, member, value, setter) => (__accessCheck$6(obj, member, "write to private field"), member.set(obj, value), value);
      var __privateMethod$1 = (obj, member, method) => (__accessCheck$6(obj, member, "access private method"), method);
      var _serializationPlugins, _buildPlugins, _intentResolvers, _inputSection, _commandSection, _availableResults, _pendingPromises, _added, _data, _Transaction_instances, fork_fn, addCommand_fn, addInput_fn, normalizeTransactionArgument_fn, resolveArgument_fn, prepareBuild_fn, runPlugins_fn, waitForPendingTasks_fn, sortCommandsAndInputs_fn;
      function createTransactionResult(index, length = Infinity) {
        const baseResult = {
          $kind: "Result",
          get Result() {
            return typeof index === "function" ? index() : index;
          }
        };
        const nestedResults = [];
        const nestedResultFor = (resultIndex) => nestedResults[resultIndex] ?? (nestedResults[resultIndex] = {
          $kind: "NestedResult",
          get NestedResult() {
            return [typeof index === "function" ? index() : index, resultIndex];
          }
        });
        return new Proxy(baseResult, {
          set() {
            throw new Error(
              "The transaction result is a proxy, and does not support setting properties directly"
            );
          },
          // TODO: Instead of making this return a concrete argument, we should ideally
          // make it reference-based (so that this gets resolved at build-time), which
          // allows re-ordering transactions.
          get(target, property) {
            if (property in target) {
              return Reflect.get(target, property);
            }
            if (property === Symbol.iterator) {
              return function* () {
                let i = 0;
                while (i < length) {
                  yield nestedResultFor(i);
                  i++;
                }
              };
            }
            if (typeof property === "symbol") return;
            const resultIndex = parseInt(property, 10);
            if (Number.isNaN(resultIndex) || resultIndex < 0) return;
            return nestedResultFor(resultIndex);
          }
        });
      }
      const TRANSACTION_BRAND = Symbol.for("@mysten/transaction");
      function isTransaction(obj) {
        return !!obj && typeof obj === "object" && obj[TRANSACTION_BRAND] === true;
      }
      const modulePluginRegistry = {
        buildPlugins: /* @__PURE__ */ new Map(),
        serializationPlugins: /* @__PURE__ */ new Map()
      };
      const TRANSACTION_REGISTRY_KEY = Symbol.for("@mysten/transaction/registry");
      function getGlobalPluginRegistry() {
        try {
          const target = globalThis;
          if (!target[TRANSACTION_REGISTRY_KEY]) {
            target[TRANSACTION_REGISTRY_KEY] = modulePluginRegistry;
          }
          return target[TRANSACTION_REGISTRY_KEY];
        } catch {
          return modulePluginRegistry;
        }
      }
      const _Transaction = class _Transaction {
        constructor() {
          __privateAdd$6(this, _Transaction_instances);
          __privateAdd$6(this, _serializationPlugins);
          __privateAdd$6(this, _buildPlugins);
          __privateAdd$6(this, _intentResolvers, /* @__PURE__ */ new Map());
          __privateAdd$6(this, _inputSection, []);
          __privateAdd$6(this, _commandSection, []);
          __privateAdd$6(this, _availableResults, /* @__PURE__ */ new Set());
          __privateAdd$6(this, _pendingPromises, /* @__PURE__ */ new Set());
          __privateAdd$6(this, _added, /* @__PURE__ */ new Map());
          __privateAdd$6(this, _data);
          /**
           * Add a new object input to the transaction.
           */
          this.object = createObjectMethods(
            (value) => {
              if (typeof value === "function") {
                return this.object(this.add(value));
              }
              if (typeof value === "object" && is(ArgumentSchema, value)) {
                return value;
              }
              const id = getIdFromCallArg(value);
              const inserted = __privateGet$6(this, _data).inputs.find((i) => id === getIdFromCallArg(i));
              if (inserted?.Object?.SharedObject && typeof value === "object" && value.Object?.SharedObject) {
                inserted.Object.SharedObject.mutable = inserted.Object.SharedObject.mutable || value.Object.SharedObject.mutable;
              }
              return inserted ? { $kind: "Input", Input: __privateGet$6(this, _data).inputs.indexOf(inserted), type: "object" } : __privateMethod$1(this, _Transaction_instances, addInput_fn).call(this, "object", typeof value === "string" ? {
                $kind: "UnresolvedObject",
                UnresolvedObject: { objectId: normalizeSuiAddress(value) }
              } : value);
            }
          );
          const globalPlugins = getGlobalPluginRegistry();
          __privateSet$5(this, _data, new TransactionDataBuilder());
          __privateSet$5(this, _buildPlugins, [...globalPlugins.buildPlugins.values()]);
          __privateSet$5(this, _serializationPlugins, [...globalPlugins.serializationPlugins.values()]);
        }
        /**
         * Converts from a serialize transaction kind (built with `build({ onlyTransactionKind: true })`) to a `Transaction` class.
         * Supports either a byte array, or base64-encoded bytes.
         */
        static fromKind(serialized) {
          const tx = new _Transaction();
          __privateSet$5(tx, _data, TransactionDataBuilder.fromKindBytes(
            typeof serialized === "string" ? fromBase64(serialized) : serialized
          ));
          __privateSet$5(tx, _inputSection, __privateGet$6(tx, _data).inputs.slice());
          __privateSet$5(tx, _commandSection, __privateGet$6(tx, _data).commands.slice());
          __privateSet$5(tx, _availableResults, new Set(__privateGet$6(tx, _commandSection).map((_, i) => i)));
          return tx;
        }
        /**
         * Converts from a serialized transaction format to a `Transaction` class.
         * There are two supported serialized formats:
         * - A string returned from `Transaction#serialize`. The serialized format must be compatible, or it will throw an error.
         * - A byte array (or base64-encoded bytes) containing BCS transaction data.
         */
        static from(transaction) {
          const newTransaction = new _Transaction();
          if (isTransaction(transaction)) {
            __privateSet$5(newTransaction, _data, TransactionDataBuilder.restore(
              transaction.getData()
            ));
          } else if (typeof transaction !== "string" || !transaction.startsWith("{")) {
            __privateSet$5(newTransaction, _data, TransactionDataBuilder.fromBytes(
              typeof transaction === "string" ? fromBase64(transaction) : transaction
            ));
          } else {
            __privateSet$5(newTransaction, _data, TransactionDataBuilder.restore(JSON.parse(transaction)));
          }
          __privateSet$5(newTransaction, _inputSection, __privateGet$6(newTransaction, _data).inputs.slice());
          __privateSet$5(newTransaction, _commandSection, __privateGet$6(newTransaction, _data).commands.slice());
          __privateSet$5(newTransaction, _availableResults, new Set(__privateGet$6(newTransaction, _commandSection).map((_, i) => i)));
          return newTransaction;
        }
        static registerGlobalSerializationPlugin(stepOrStep, step) {
          getGlobalPluginRegistry().serializationPlugins.set(
            stepOrStep,
            step ?? stepOrStep
          );
        }
        static unregisterGlobalSerializationPlugin(name) {
          getGlobalPluginRegistry().serializationPlugins.delete(name);
        }
        static registerGlobalBuildPlugin(stepOrStep, step) {
          getGlobalPluginRegistry().buildPlugins.set(
            stepOrStep,
            step ?? stepOrStep
          );
        }
        static unregisterGlobalBuildPlugin(name) {
          getGlobalPluginRegistry().buildPlugins.delete(name);
        }
        addSerializationPlugin(step) {
          __privateGet$6(this, _serializationPlugins).push(step);
        }
        addBuildPlugin(step) {
          __privateGet$6(this, _buildPlugins).push(step);
        }
        addIntentResolver(intent, resolver) {
          if (__privateGet$6(this, _intentResolvers).has(intent) && __privateGet$6(this, _intentResolvers).get(intent) !== resolver) {
            throw new Error(`Intent resolver for ${intent} already exists`);
          }
          __privateGet$6(this, _intentResolvers).set(intent, resolver);
        }
        setSender(sender) {
          __privateGet$6(this, _data).sender = sender;
        }
        /**
         * Sets the sender only if it has not already been set.
         * This is useful for sponsored transaction flows where the sender may not be the same as the signer address.
         */
        setSenderIfNotSet(sender) {
          if (!__privateGet$6(this, _data).sender) {
            __privateGet$6(this, _data).sender = sender;
          }
        }
        setExpiration(expiration) {
          __privateGet$6(this, _data).expiration = expiration ? parse(TransactionExpiration$3, expiration) : null;
        }
        setGasPrice(price) {
          __privateGet$6(this, _data).gasConfig.price = String(price);
        }
        setGasBudget(budget) {
          __privateGet$6(this, _data).gasConfig.budget = String(budget);
        }
        setGasBudgetIfNotSet(budget) {
          if (__privateGet$6(this, _data).gasData.budget == null) {
            __privateGet$6(this, _data).gasConfig.budget = String(budget);
          }
        }
        setGasOwner(owner) {
          __privateGet$6(this, _data).gasConfig.owner = owner;
        }
        setGasPayment(payments) {
          __privateGet$6(this, _data).gasConfig.payment = payments.map((payment) => parse(ObjectRefSchema, payment));
        }
        /** @deprecated Use `getData()` instead. */
        get blockData() {
          return serializeV1TransactionData(__privateGet$6(this, _data).snapshot());
        }
        /** Get a snapshot of the transaction data, in JSON form: */
        getData() {
          return __privateGet$6(this, _data).snapshot();
        }
        // Used to brand transaction classes so that they can be identified, even between multiple copies
        // of the builder.
        get [TRANSACTION_BRAND]() {
          return true;
        }
        // Temporary workaround for the wallet interface accidentally serializing transactions via postMessage
        get pure() {
          Object.defineProperty(this, "pure", {
            enumerable: false,
            value: createPure((value) => {
              if (isSerializedBcs(value)) {
                return __privateMethod$1(this, _Transaction_instances, addInput_fn).call(this, "pure", {
                  $kind: "Pure",
                  Pure: {
                    bytes: value.toBase64()
                  }
                });
              }
              return __privateMethod$1(this, _Transaction_instances, addInput_fn).call(this, "pure", is(NormalizedCallArg$1, value) ? parse(NormalizedCallArg$1, value) : value instanceof Uint8Array ? Inputs.Pure(value) : { $kind: "UnresolvedPure", UnresolvedPure: { value } });
            })
          });
          return this.pure;
        }
        /** Returns an argument for the gas coin, to be used in a transaction. */
        get gas() {
          return { $kind: "GasCoin", GasCoin: true };
        }
        /**
         * Add a new object input to the transaction using the fully-resolved object reference.
         * If you only have an object ID, use `builder.object(id)` instead.
         */
        objectRef(...args) {
          return this.object(Inputs.ObjectRef(...args));
        }
        /**
         * Add a new receiving input to the transaction using the fully-resolved object reference.
         * If you only have an object ID, use `builder.object(id)` instead.
         */
        receivingRef(...args) {
          return this.object(Inputs.ReceivingRef(...args));
        }
        /**
         * Add a new shared object input to the transaction using the fully-resolved shared object reference.
         * If you only have an object ID, use `builder.object(id)` instead.
         */
        sharedObjectRef(...args) {
          return this.object(Inputs.SharedObjectRef(...args));
        }
        add(command) {
          if (typeof command === "function") {
            if (__privateGet$6(this, _added).has(command)) {
              return __privateGet$6(this, _added).get(command);
            }
            const fork = __privateMethod$1(this, _Transaction_instances, fork_fn).call(this);
            const result = command(fork);
            if (!(result && typeof result === "object" && "then" in result)) {
              __privateSet$5(this, _availableResults, __privateGet$6(fork, _availableResults));
              __privateGet$6(this, _added).set(command, result);
              return result;
            }
            const placeholder = __privateMethod$1(this, _Transaction_instances, addCommand_fn).call(this, {
              $kind: "$Intent",
              $Intent: {
                name: "AsyncTransactionThunk",
                inputs: {},
                data: {
                  resultIndex: __privateGet$6(this, _data).commands.length,
                  result: null
                }
              }
            });
            __privateGet$6(this, _pendingPromises).add(
              Promise.resolve(result).then((result2) => {
                placeholder.$Intent.data.result = result2;
              })
            );
            const txResult = createTransactionResult(() => placeholder.$Intent.data.resultIndex);
            __privateGet$6(this, _added).set(command, txResult);
            return txResult;
          } else {
            __privateMethod$1(this, _Transaction_instances, addCommand_fn).call(this, command);
          }
          return createTransactionResult(__privateGet$6(this, _data).commands.length - 1);
        }
        // Method shorthands:
        splitCoins(coin, amounts) {
          const command = Commands.SplitCoins(
            typeof coin === "string" ? this.object(coin) : __privateMethod$1(this, _Transaction_instances, resolveArgument_fn).call(this, coin),
            amounts.map(
              (amount) => typeof amount === "number" || typeof amount === "bigint" || typeof amount === "string" ? this.pure.u64(amount) : __privateMethod$1(this, _Transaction_instances, normalizeTransactionArgument_fn).call(this, amount)
            )
          );
          __privateMethod$1(this, _Transaction_instances, addCommand_fn).call(this, command);
          return createTransactionResult(__privateGet$6(this, _data).commands.length - 1, amounts.length);
        }
        mergeCoins(destination, sources) {
          return this.add(
            Commands.MergeCoins(
              this.object(destination),
              sources.map((src) => this.object(src))
            )
          );
        }
        publish({ modules, dependencies }) {
          return this.add(
            Commands.Publish({
              modules,
              dependencies
            })
          );
        }
        upgrade({
          modules,
          dependencies,
          package: packageId,
          ticket
        }) {
          return this.add(
            Commands.Upgrade({
              modules,
              dependencies,
              package: packageId,
              ticket: this.object(ticket)
            })
          );
        }
        moveCall({
          arguments: args,
          ...input
        }) {
          return this.add(
            Commands.MoveCall({
              ...input,
              arguments: args?.map((arg) => __privateMethod$1(this, _Transaction_instances, normalizeTransactionArgument_fn).call(this, arg))
            })
          );
        }
        transferObjects(objects, address) {
          return this.add(
            Commands.TransferObjects(
              objects.map((obj) => this.object(obj)),
              typeof address === "string" ? this.pure.address(address) : __privateMethod$1(this, _Transaction_instances, normalizeTransactionArgument_fn).call(this, address)
            )
          );
        }
        makeMoveVec({
          type,
          elements
        }) {
          return this.add(
            Commands.MakeMoveVec({
              type,
              elements: elements.map((obj) => this.object(obj))
            })
          );
        }
        /**
         * @deprecated Use toJSON instead.
         * For synchronous serialization, you can use `getData()`
         * */
        serialize() {
          return JSON.stringify(serializeV1TransactionData(__privateGet$6(this, _data).snapshot()));
        }
        async toJSON(options = {}) {
          await this.prepareForSerialization(options);
          const fullyResolved = this.isFullyResolved();
          return JSON.stringify(
            parse(
              SerializedTransactionDataV2Schema,
              fullyResolved ? {
                ...__privateGet$6(this, _data).snapshot(),
                digest: __privateGet$6(this, _data).getDigest()
              } : __privateGet$6(this, _data).snapshot()
            ),
            (_key, value) => typeof value === "bigint" ? value.toString() : value,
            2
          );
        }
        /** Build the transaction to BCS bytes, and sign it with the provided keypair. */
        async sign(options) {
          const { signer, ...buildOptions } = options;
          const bytes = await this.build(buildOptions);
          return signer.signTransaction(bytes);
        }
        /**
         *  Ensures that:
         *  - All objects have been fully resolved to a specific version
         *  - All pure inputs have been serialized to bytes
         *  - All async thunks have been fully resolved
         *  - All transaction intents have been resolved
         * 	- The gas payment, budget, and price have been set
         *  - The transaction sender has been set
         *
         *  When true, the transaction will always be built to the same bytes and digest (unless the transaction is mutated)
         */
        isFullyResolved() {
          if (!__privateGet$6(this, _data).sender) {
            return false;
          }
          if (__privateGet$6(this, _pendingPromises).size > 0) {
            return false;
          }
          if (__privateGet$6(this, _data).commands.some((cmd) => cmd.$Intent)) {
            return false;
          }
          if (needsTransactionResolution(__privateGet$6(this, _data), {})) {
            return false;
          }
          return true;
        }
        /** Build the transaction to BCS bytes. */
        async build(options = {}) {
          await this.prepareForSerialization(options);
          await __privateMethod$1(this, _Transaction_instances, prepareBuild_fn).call(this, options);
          return __privateGet$6(this, _data).build({
            onlyTransactionKind: options.onlyTransactionKind
          });
        }
        /** Derive transaction digest */
        async getDigest(options = {}) {
          await this.prepareForSerialization(options);
          await __privateMethod$1(this, _Transaction_instances, prepareBuild_fn).call(this, options);
          return __privateGet$6(this, _data).getDigest();
        }
        async prepareForSerialization(options) {
          await __privateMethod$1(this, _Transaction_instances, waitForPendingTasks_fn).call(this);
          __privateMethod$1(this, _Transaction_instances, sortCommandsAndInputs_fn).call(this);
          const intents = /* @__PURE__ */ new Set();
          for (const command of __privateGet$6(this, _data).commands) {
            if (command.$Intent) {
              intents.add(command.$Intent.name);
            }
          }
          const steps = [...__privateGet$6(this, _serializationPlugins)];
          for (const intent of intents) {
            if (options.supportedIntents?.includes(intent)) {
              continue;
            }
            if (!__privateGet$6(this, _intentResolvers).has(intent)) {
              throw new Error(`Missing intent resolver for ${intent}`);
            }
            steps.push(__privateGet$6(this, _intentResolvers).get(intent));
          }
          steps.push(namedPackagesPlugin());
          await __privateMethod$1(this, _Transaction_instances, runPlugins_fn).call(this, steps, options);
        }
      };
      _serializationPlugins = new WeakMap();
      _buildPlugins = new WeakMap();
      _intentResolvers = new WeakMap();
      _inputSection = new WeakMap();
      _commandSection = new WeakMap();
      _availableResults = new WeakMap();
      _pendingPromises = new WeakMap();
      _added = new WeakMap();
      _data = new WeakMap();
      _Transaction_instances = new WeakSet();
      fork_fn = function() {
        const fork = new _Transaction();
        __privateSet$5(fork, _data, __privateGet$6(this, _data));
        __privateSet$5(fork, _serializationPlugins, __privateGet$6(this, _serializationPlugins));
        __privateSet$5(fork, _buildPlugins, __privateGet$6(this, _buildPlugins));
        __privateSet$5(fork, _intentResolvers, __privateGet$6(this, _intentResolvers));
        __privateSet$5(fork, _pendingPromises, __privateGet$6(this, _pendingPromises));
        __privateSet$5(fork, _availableResults, new Set(__privateGet$6(this, _availableResults)));
        __privateSet$5(fork, _added, __privateGet$6(this, _added));
        __privateGet$6(this, _inputSection).push(__privateGet$6(fork, _inputSection));
        __privateGet$6(this, _commandSection).push(__privateGet$6(fork, _commandSection));
        return fork;
      };
      addCommand_fn = function(command) {
        const resultIndex = __privateGet$6(this, _data).commands.length;
        __privateGet$6(this, _commandSection).push(command);
        __privateGet$6(this, _availableResults).add(resultIndex);
        __privateGet$6(this, _data).commands.push(command);
        __privateGet$6(this, _data).mapCommandArguments(resultIndex, (arg) => {
          if (arg.$kind === "Result" && !__privateGet$6(this, _availableResults).has(arg.Result)) {
            throw new Error(
              `Result { Result: ${arg.Result} } is not available to use the current transaction`
            );
          }
          if (arg.$kind === "NestedResult" && !__privateGet$6(this, _availableResults).has(arg.NestedResult[0])) {
            throw new Error(
              `Result { NestedResult: [${arg.NestedResult[0]}, ${arg.NestedResult[1]}] } is not available to use the current transaction`
            );
          }
          if (arg.$kind === "Input" && arg.Input >= __privateGet$6(this, _data).inputs.length) {
            throw new Error(
              `Input { Input: ${arg.Input} } references an input that does not exist in the current transaction`
            );
          }
          return arg;
        });
        return command;
      };
      addInput_fn = function(type, input) {
        __privateGet$6(this, _inputSection).push(input);
        return __privateGet$6(this, _data).addInput(type, input);
      };
      normalizeTransactionArgument_fn = function(arg) {
        if (isSerializedBcs(arg)) {
          return this.pure(arg);
        }
        return __privateMethod$1(this, _Transaction_instances, resolveArgument_fn).call(this, arg);
      };
      resolveArgument_fn = function(arg) {
        if (typeof arg === "function") {
          const resolved = this.add(arg);
          if (typeof resolved === "function") {
            return __privateMethod$1(this, _Transaction_instances, resolveArgument_fn).call(this, resolved);
          }
          return parse(ArgumentSchema, resolved);
        }
        return parse(ArgumentSchema, arg);
      };
      prepareBuild_fn = async function(options) {
        if (!options.onlyTransactionKind && !__privateGet$6(this, _data).sender) {
          throw new Error("Missing transaction sender");
        }
        await __privateMethod$1(this, _Transaction_instances, runPlugins_fn).call(this, [...__privateGet$6(this, _buildPlugins), resolveTransactionPlugin], options);
      };
      runPlugins_fn = async function(plugins, options) {
        try {
          const createNext = (i) => {
            if (i >= plugins.length) {
              return () => {
              };
            }
            const plugin = plugins[i];
            return async () => {
              const next = createNext(i + 1);
              let calledNext = false;
              let nextResolved = false;
              await plugin(__privateGet$6(this, _data), options, async () => {
                if (calledNext) {
                  throw new Error(`next() was call multiple times in TransactionPlugin ${i}`);
                }
                calledNext = true;
                await next();
                nextResolved = true;
              });
              if (!calledNext) {
                throw new Error(`next() was not called in TransactionPlugin ${i}`);
              }
              if (!nextResolved) {
                throw new Error(`next() was not awaited in TransactionPlugin ${i}`);
              }
            };
          };
          await createNext(0)();
        } finally {
          __privateSet$5(this, _inputSection, __privateGet$6(this, _data).inputs.slice());
          __privateSet$5(this, _commandSection, __privateGet$6(this, _data).commands.slice());
        }
      };
      waitForPendingTasks_fn = async function() {
        while (__privateGet$6(this, _pendingPromises).size > 0) {
          const newPromise = Promise.all(__privateGet$6(this, _pendingPromises));
          __privateGet$6(this, _pendingPromises).clear();
          __privateGet$6(this, _pendingPromises).add(newPromise);
          await newPromise;
          __privateGet$6(this, _pendingPromises).delete(newPromise);
        }
      };
      sortCommandsAndInputs_fn = function() {
        const unorderedCommands = __privateGet$6(this, _data).commands;
        const unorderedInputs = __privateGet$6(this, _data).inputs;
        const orderedCommands = __privateGet$6(this, _commandSection).flat(Infinity);
        const orderedInputs = __privateGet$6(this, _inputSection).flat(Infinity);
        if (orderedCommands.length !== unorderedCommands.length) {
          throw new Error("Unexpected number of commands found in transaction data");
        }
        if (orderedInputs.length !== unorderedInputs.length) {
          throw new Error("Unexpected number of inputs found in transaction data");
        }
        const filteredCommands = orderedCommands.filter(
          (cmd) => cmd.$Intent?.name !== "AsyncTransactionThunk"
        );
        __privateGet$6(this, _data).commands = filteredCommands;
        __privateGet$6(this, _data).inputs = orderedInputs;
        __privateSet$5(this, _commandSection, filteredCommands);
        __privateSet$5(this, _inputSection, orderedInputs);
        __privateSet$5(this, _availableResults, new Set(filteredCommands.map((_, i) => i)));
        function getOriginalIndex(index) {
          const command = unorderedCommands[index];
          if (command.$Intent?.name === "AsyncTransactionThunk") {
            const result = command.$Intent.data.result;
            if (result == null) {
              throw new Error("AsyncTransactionThunk has not been resolved");
            }
            return getOriginalIndex(result.Result);
          }
          const updated = filteredCommands.indexOf(command);
          if (updated === -1) {
            throw new Error("Unable to find original index for command");
          }
          return updated;
        }
        __privateGet$6(this, _data).mapArguments((arg) => {
          if (arg.$kind === "Input") {
            const updated = orderedInputs.indexOf(unorderedInputs[arg.Input]);
            if (updated === -1) {
              throw new Error("Input has not been resolved");
            }
            return { ...arg, Input: updated };
          } else if (arg.$kind === "Result") {
            const updated = getOriginalIndex(arg.Result);
            return { ...arg, Result: updated };
          } else if (arg.$kind === "NestedResult") {
            const updated = getOriginalIndex(arg.NestedResult[0]);
            return { ...arg, NestedResult: [updated, arg.NestedResult[1]] };
          }
          return arg;
        });
        for (const [i, cmd] of unorderedCommands.entries()) {
          if (cmd.$Intent?.name === "AsyncTransactionThunk") {
            try {
              cmd.$Intent.data.resultIndex = getOriginalIndex(i);
            } catch {
            }
          }
        }
      };
      let Transaction = exports("Transaction", _Transaction);

      const DEFAULT_MVR_URLS = {
        mainnet: "https://mainnet.mvr.mystenlabs.com",
        testnet: "https://testnet.mvr.mystenlabs.com"
      };
      class Experimental_CoreClient extends Experimental_BaseClient {
        constructor(options) {
          super(options);
          this.core = this;
          this.mvr = new MvrClient({
            cache: this.cache.scope("core.mvr"),
            url: options.mvr?.url ?? DEFAULT_MVR_URLS[this.network],
            pageSize: options.mvr?.pageSize,
            overrides: options.mvr?.overrides
          });
        }
        async getObject(options) {
          const { objectId } = options;
          const {
            objects: [result]
          } = await this.getObjects({ objectIds: [objectId], signal: options.signal });
          if (result instanceof Error) {
            throw result;
          }
          return { object: result };
        }
        async getDynamicField(options) {
          const normalizedNameType = TypeTagSerializer.parseFromStr(
            (await this.core.mvr.resolveType({
              type: options.name.type
            })).type
          );
          const fieldId = deriveDynamicFieldID(options.parentId, normalizedNameType, options.name.bcs);
          const {
            objects: [fieldObject]
          } = await this.getObjects({
            objectIds: [fieldId],
            signal: options.signal
          });
          if (fieldObject instanceof Error) {
            throw fieldObject;
          }
          const fieldType = parseStructTag(fieldObject.type);
          const content = await fieldObject.content;
          return {
            dynamicField: {
              id: fieldObject.id,
              digest: fieldObject.digest,
              version: fieldObject.version,
              type: fieldObject.type,
              previousTransaction: fieldObject.previousTransaction,
              name: {
                type: typeof fieldType.typeParams[0] === "string" ? fieldType.typeParams[0] : normalizeStructTag(fieldType.typeParams[0]),
                bcs: options.name.bcs
              },
              value: {
                type: typeof fieldType.typeParams[1] === "string" ? fieldType.typeParams[1] : normalizeStructTag(fieldType.typeParams[1]),
                bcs: content.slice(SUI_ADDRESS_LENGTH + options.name.bcs.length)
              }
            }
          };
        }
        async waitForTransaction({
          signal,
          timeout = 60 * 1e3,
          ...input
        }) {
          const abortSignal = signal ? AbortSignal.any([AbortSignal.timeout(timeout), signal]) : AbortSignal.timeout(timeout);
          const abortPromise = new Promise((_, reject) => {
            abortSignal.addEventListener("abort", () => reject(abortSignal.reason));
          });
          abortPromise.catch(() => {
          });
          while (true) {
            abortSignal.throwIfAborted();
            try {
              return await this.getTransaction({
                ...input,
                signal: abortSignal
              });
            } catch {
              await Promise.race([new Promise((resolve) => setTimeout(resolve, 2e3)), abortPromise]);
            }
          }
        }
      }

      class SuiClientError extends Error {
      }
      class ObjectError extends SuiClientError {
        constructor(code, message) {
          super(message);
          this.code = code;
        }
        static fromResponse(response, objectId) {
          switch (response.code) {
            case "notExists":
              return new ObjectError(response.code, `Object ${response.object_id} does not exist`);
            case "dynamicFieldNotFound":
              return new ObjectError(
                response.code,
                `Dynamic field not found for object ${response.parent_object_id}`
              );
            case "deleted":
              return new ObjectError(response.code, `Object ${response.object_id} has been deleted`);
            case "displayError":
              return new ObjectError(response.code, `Display error: ${response.error}`);
            case "unknown":
            default:
              return new ObjectError(
                response.code,
                `Unknown error while loading object${objectId ? ` ${objectId}` : ""}`
              );
          }
        }
      }

      function parseTransactionBcs(bytes) {
        return {
          ...TransactionDataBuilder.fromBytes(bytes).snapshot(),
          bcs: bytes
        };
      }
      function parseTransactionEffectsBcs(effects) {
        const parsed = suiBcs.TransactionEffects.parse(effects);
        switch (parsed.$kind) {
          case "V1":
            return parseTransactionEffectsV1({ effects: parsed.V1 });
          case "V2":
            return parseTransactionEffectsV2({ bytes: effects, effects: parsed.V2 });
          default:
            throw new Error(
              `Unknown transaction effects version: ${parsed.$kind}`
            );
        }
      }
      function parseTransactionEffectsV1(_) {
        throw new Error("V1 effects are not supported yet");
      }
      function parseTransactionEffectsV2({
        bytes,
        effects
      }) {
        const changedObjects = effects.changedObjects.map(
          ([id, change]) => {
            return {
              id,
              inputState: change.inputState.$kind === "Exist" ? "Exists" : "DoesNotExist",
              inputVersion: change.inputState.Exist?.[0][0] ?? null,
              inputDigest: change.inputState.Exist?.[0][1] ?? null,
              inputOwner: change.inputState.Exist?.[1] ?? null,
              outputState: change.outputState.$kind === "NotExist" ? "DoesNotExist" : change.outputState.$kind,
              outputVersion: change.outputState.$kind === "PackageWrite" ? change.outputState.PackageWrite?.[0] : change.outputState.ObjectWrite ? effects.lamportVersion : null,
              outputDigest: change.outputState.$kind === "PackageWrite" ? change.outputState.PackageWrite?.[1] : change.outputState.ObjectWrite?.[0] ?? null,
              outputOwner: change.outputState.ObjectWrite ? change.outputState.ObjectWrite[1] : null,
              idOperation: change.idOperation.$kind
            };
          }
        );
        return {
          bcs: bytes,
          digest: effects.transactionDigest,
          version: 2,
          status: effects.status.$kind === "Success" ? {
            success: true,
            error: null
          } : {
            success: false,
            // TODO: add command
            error: effects.status.Failed.error.$kind
          },
          gasUsed: effects.gasUsed,
          transactionDigest: effects.transactionDigest,
          gasObject: effects.gasObjectIndex === null ? null : changedObjects[effects.gasObjectIndex] ?? null,
          eventsDigest: effects.eventsDigest,
          dependencies: effects.dependencies,
          lamportVersion: effects.lamportVersion,
          changedObjects,
          unchangedConsensusObjects: effects.unchangedSharedObjects.map(
            ([objectId, object]) => {
              return {
                kind: object.$kind === "MutateDeleted" ? "MutateConsensusStreamEnded" : object.$kind === "ReadDeleted" ? "ReadConsensusStreamEnded" : object.$kind,
                objectId,
                version: object.$kind === "ReadOnlyRoot" ? object.ReadOnlyRoot[0] : object[object.$kind],
                digest: object.$kind === "ReadOnlyRoot" ? object.ReadOnlyRoot[1] : null
              };
            }
          ),
          auxiliaryDataDigest: effects.auxDataDigest
        };
      }

      var __typeError$5 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$5 = (obj, member, msg) => member.has(obj) || __typeError$5("Cannot " + msg);
      var __privateGet$5 = (obj, member, getter) => (__accessCheck$5(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$5 = (obj, member, value) => member.has(obj) ? __typeError$5("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$4 = (obj, member, value, setter) => (__accessCheck$5(obj, member, "write to private field"), member.set(obj, value), value);
      var _jsonRpcClient;
      class JSONRpcCoreClient extends Experimental_CoreClient {
        constructor({
          jsonRpcClient,
          mvr
        }) {
          super({ network: jsonRpcClient.network, base: jsonRpcClient, mvr });
          __privateAdd$5(this, _jsonRpcClient);
          __privateSet$4(this, _jsonRpcClient, jsonRpcClient);
        }
        async getObjects(options) {
          const batches = chunk(options.objectIds, 50);
          const results = [];
          for (const batch of batches) {
            const objects = await __privateGet$5(this, _jsonRpcClient).multiGetObjects({
              ids: batch,
              options: {
                showOwner: true,
                showType: true,
                showBcs: true,
                showPreviousTransaction: true
              },
              signal: options.signal
            });
            for (const [idx, object] of objects.entries()) {
              if (object.error) {
                results.push(ObjectError.fromResponse(object.error, batch[idx]));
              } else {
                results.push(parseObject(object.data));
              }
            }
          }
          return {
            objects: results
          };
        }
        async getOwnedObjects(options) {
          const objects = await __privateGet$5(this, _jsonRpcClient).getOwnedObjects({
            owner: options.address,
            limit: options.limit,
            cursor: options.cursor,
            options: {
              showOwner: true,
              showType: true,
              showBcs: true,
              showPreviousTransaction: true
            },
            filter: options.type ? { StructType: options.type } : null,
            signal: options.signal
          });
          return {
            objects: objects.data.map((result) => {
              if (result.error) {
                throw ObjectError.fromResponse(result.error);
              }
              return parseObject(result.data);
            }),
            hasNextPage: objects.hasNextPage,
            cursor: objects.nextCursor ?? null
          };
        }
        async getCoins(options) {
          const coins = await __privateGet$5(this, _jsonRpcClient).getCoins({
            owner: options.address,
            coinType: options.coinType,
            limit: options.limit,
            cursor: options.cursor,
            signal: options.signal
          });
          return {
            objects: coins.data.map((coin) => {
              return {
                id: coin.coinObjectId,
                version: coin.version,
                digest: coin.digest,
                balance: coin.balance,
                type: `0x2::coin::Coin<${coin.coinType}>`,
                content: Promise.resolve(
                  Coin.serialize({
                    id: coin.coinObjectId,
                    balance: {
                      value: coin.balance
                    }
                  }).toBytes()
                ),
                owner: {
                  $kind: "ObjectOwner",
                  ObjectOwner: options.address
                },
                previousTransaction: coin.previousTransaction
              };
            }),
            hasNextPage: coins.hasNextPage,
            cursor: coins.nextCursor ?? null
          };
        }
        async getBalance(options) {
          const balance = await __privateGet$5(this, _jsonRpcClient).getBalance({
            owner: options.address,
            coinType: options.coinType,
            signal: options.signal
          });
          return {
            balance: {
              coinType: balance.coinType,
              balance: balance.totalBalance
            }
          };
        }
        async getAllBalances(options) {
          const balances = await __privateGet$5(this, _jsonRpcClient).getAllBalances({
            owner: options.address,
            signal: options.signal
          });
          return {
            balances: balances.map((balance) => ({
              coinType: balance.coinType,
              balance: balance.totalBalance
            })),
            hasNextPage: false,
            cursor: null
          };
        }
        async getTransaction(options) {
          const transaction = await __privateGet$5(this, _jsonRpcClient).getTransactionBlock({
            digest: options.digest,
            options: {
              showRawInput: true,
              showObjectChanges: true,
              showRawEffects: true,
              showEvents: true,
              showEffects: true,
              showBalanceChanges: true
            },
            signal: options.signal
          });
          return {
            transaction: parseTransaction(transaction)
          };
        }
        async executeTransaction(options) {
          const transaction = await __privateGet$5(this, _jsonRpcClient).executeTransactionBlock({
            transactionBlock: options.transaction,
            signature: options.signatures,
            options: {
              showRawEffects: true,
              showEvents: true,
              showObjectChanges: true,
              showRawInput: true,
              showEffects: true,
              showBalanceChanges: true
            },
            signal: options.signal
          });
          return {
            transaction: parseTransaction(transaction)
          };
        }
        async dryRunTransaction(options) {
          const tx = Transaction.from(options.transaction);
          const result = await __privateGet$5(this, _jsonRpcClient).dryRunTransactionBlock({
            transactionBlock: options.transaction,
            signal: options.signal
          });
          const { effects, objectTypes } = parseTransactionEffectsJson({
            effects: result.effects,
            objectChanges: result.objectChanges
          });
          return {
            transaction: {
              digest: await tx.getDigest(),
              epoch: null,
              effects,
              objectTypes: Promise.resolve(objectTypes),
              signatures: [],
              transaction: parseTransactionBcs(options.transaction),
              balanceChanges: result.balanceChanges.map((change) => ({
                coinType: change.coinType,
                address: parseOwnerAddress(change.owner),
                amount: change.amount
              }))
            }
          };
        }
        async getReferenceGasPrice(options) {
          const referenceGasPrice = await __privateGet$5(this, _jsonRpcClient).getReferenceGasPrice({
            signal: options?.signal
          });
          return {
            referenceGasPrice: String(referenceGasPrice)
          };
        }
        async getDynamicFields(options) {
          const dynamicFields = await __privateGet$5(this, _jsonRpcClient).getDynamicFields({
            parentId: options.parentId,
            limit: options.limit,
            cursor: options.cursor
          });
          return {
            dynamicFields: dynamicFields.data.map((dynamicField) => {
              return {
                id: dynamicField.objectId,
                type: dynamicField.objectType,
                name: {
                  type: dynamicField.name.type,
                  bcs: fromBase64(dynamicField.bcsName)
                }
              };
            }),
            hasNextPage: dynamicFields.hasNextPage,
            cursor: dynamicFields.nextCursor
          };
        }
        async verifyZkLoginSignature(options) {
          const result = await __privateGet$5(this, _jsonRpcClient).verifyZkLoginSignature({
            bytes: options.bytes,
            signature: options.signature,
            intentScope: options.intentScope,
            author: options.author
          });
          return {
            success: result.success,
            errors: result.errors
          };
        }
        resolveNameServiceNames(options) {
          return __privateGet$5(this, _jsonRpcClient).resolveNameServiceNames(options);
        }
        resolveTransactionPlugin() {
          return jsonRpcClientResolveTransactionPlugin(__privateGet$5(this, _jsonRpcClient));
        }
        async getMoveFunction(options) {
          const result = await __privateGet$5(this, _jsonRpcClient).getNormalizedMoveFunction({
            package: (await this.mvr.resolvePackage({ package: options.packageId })).package,
            module: options.moduleName,
            function: options.name
          });
          return {
            function: {
              packageId: normalizeSuiAddress(options.packageId),
              moduleName: options.moduleName,
              name: options.name,
              visibility: parseVisibility(result.visibility),
              isEntry: result.isEntry,
              typeParameters: result.typeParameters.map((abilities) => ({
                isPhantom: false,
                constraints: parseAbilities(abilities)
              })),
              parameters: result.parameters.map((param) => parseNormalizedSuiMoveType(param)),
              returns: result.return.map((ret) => parseNormalizedSuiMoveType(ret))
            }
          };
        }
      }
      _jsonRpcClient = new WeakMap();
      function parseObject(object) {
        return {
          id: object.objectId,
          version: object.version,
          digest: object.digest,
          type: object.type,
          content: Promise.resolve(
            object.bcs?.dataType === "moveObject" ? fromBase64(object.bcs.bcsBytes) : new Uint8Array()
          ),
          owner: parseOwner(object.owner),
          previousTransaction: object.previousTransaction ?? null
        };
      }
      function parseOwner(owner) {
        if (owner === "Immutable") {
          return {
            $kind: "Immutable",
            Immutable: true
          };
        }
        if ("ConsensusAddressOwner" in owner) {
          return {
            $kind: "ConsensusAddressOwner",
            ConsensusAddressOwner: {
              owner: owner.ConsensusAddressOwner.owner,
              startVersion: owner.ConsensusAddressOwner.start_version
            }
          };
        }
        if ("AddressOwner" in owner) {
          return {
            $kind: "AddressOwner",
            AddressOwner: owner.AddressOwner
          };
        }
        if ("ObjectOwner" in owner) {
          return {
            $kind: "ObjectOwner",
            ObjectOwner: owner.ObjectOwner
          };
        }
        if ("Shared" in owner) {
          return {
            $kind: "Shared",
            Shared: {
              initialSharedVersion: owner.Shared.initial_shared_version
            }
          };
        }
        throw new Error(`Unknown owner type: ${JSON.stringify(owner)}`);
      }
      function parseOwnerAddress(owner) {
        if (owner === "Immutable") {
          return null;
        }
        if ("ConsensusAddressOwner" in owner) {
          return owner.ConsensusAddressOwner.owner;
        }
        if ("AddressOwner" in owner) {
          return owner.AddressOwner;
        }
        if ("ObjectOwner" in owner) {
          return owner.ObjectOwner;
        }
        if ("Shared" in owner) {
          return null;
        }
        throw new Error(`Unknown owner type: ${JSON.stringify(owner)}`);
      }
      function parseTransaction(transaction) {
        const parsedTx = suiBcs.SenderSignedData.parse(fromBase64(transaction.rawTransaction))[0];
        const objectTypes = {};
        transaction.objectChanges?.forEach((change) => {
          if (change.type !== "published") {
            objectTypes[change.objectId] = change.objectType;
          }
        });
        const bytes = suiBcs.TransactionData.serialize(parsedTx.intentMessage.value).toBytes();
        const data = TransactionDataBuilder.restore({
          version: 2,
          sender: parsedTx.intentMessage.value.V1.sender,
          expiration: parsedTx.intentMessage.value.V1.expiration,
          gasData: parsedTx.intentMessage.value.V1.gasData,
          inputs: parsedTx.intentMessage.value.V1.kind.ProgrammableTransaction.inputs,
          commands: parsedTx.intentMessage.value.V1.kind.ProgrammableTransaction.commands
        });
        return {
          digest: transaction.digest,
          epoch: transaction.effects?.executedEpoch ?? null,
          effects: parseTransactionEffectsBcs(new Uint8Array(transaction.rawEffects)),
          objectTypes: Promise.resolve(objectTypes),
          transaction: {
            ...data,
            bcs: bytes
          },
          signatures: parsedTx.txSignatures,
          balanceChanges: transaction.balanceChanges?.map((change) => ({
            coinType: change.coinType,
            address: parseOwnerAddress(change.owner),
            amount: change.amount
          })) ?? []
        };
      }
      function parseTransactionEffectsJson({
        bytes,
        effects,
        objectChanges
      }) {
        const changedObjects = [];
        const unchangedConsensusObjects = [];
        const objectTypes = {};
        objectChanges?.forEach((change) => {
          switch (change.type) {
            case "published":
              changedObjects.push({
                id: change.packageId,
                inputState: "DoesNotExist",
                inputVersion: null,
                inputDigest: null,
                inputOwner: null,
                outputState: "PackageWrite",
                outputVersion: change.version,
                outputDigest: change.digest,
                outputOwner: null,
                idOperation: "Created"
              });
              break;
            case "transferred":
              changedObjects.push({
                id: change.objectId,
                inputState: "Exists",
                inputVersion: change.version,
                inputDigest: change.digest,
                inputOwner: {
                  $kind: "AddressOwner",
                  AddressOwner: change.sender
                },
                outputState: "ObjectWrite",
                outputVersion: change.version,
                outputDigest: change.digest,
                outputOwner: parseOwner(change.recipient),
                idOperation: "None"
              });
              objectTypes[change.objectId] = change.objectType;
              break;
            case "mutated":
              changedObjects.push({
                id: change.objectId,
                inputState: "Exists",
                inputVersion: change.previousVersion,
                inputDigest: null,
                inputOwner: parseOwner(change.owner),
                outputState: "ObjectWrite",
                outputVersion: change.version,
                outputDigest: change.digest,
                outputOwner: parseOwner(change.owner),
                idOperation: "None"
              });
              objectTypes[change.objectId] = change.objectType;
              break;
            case "deleted":
              changedObjects.push({
                id: change.objectId,
                inputState: "Exists",
                inputVersion: change.version,
                inputDigest: effects.deleted?.find((d) => d.objectId === change.objectId)?.digest ?? null,
                inputOwner: null,
                outputState: "DoesNotExist",
                outputVersion: null,
                outputDigest: null,
                outputOwner: null,
                idOperation: "Deleted"
              });
              objectTypes[change.objectId] = change.objectType;
              break;
            case "wrapped":
              changedObjects.push({
                id: change.objectId,
                inputState: "Exists",
                inputVersion: change.version,
                inputDigest: null,
                inputOwner: {
                  $kind: "AddressOwner",
                  AddressOwner: change.sender
                },
                outputState: "ObjectWrite",
                outputVersion: change.version,
                outputDigest: effects.wrapped?.find((w) => w.objectId === change.objectId)?.digest ?? null,
                outputOwner: {
                  $kind: "ObjectOwner",
                  ObjectOwner: change.sender
                },
                idOperation: "None"
              });
              objectTypes[change.objectId] = change.objectType;
              break;
            case "created":
              changedObjects.push({
                id: change.objectId,
                inputState: "DoesNotExist",
                inputVersion: null,
                inputDigest: null,
                inputOwner: null,
                outputState: "ObjectWrite",
                outputVersion: change.version,
                outputDigest: change.digest,
                outputOwner: parseOwner(change.owner),
                idOperation: "Created"
              });
              objectTypes[change.objectId] = change.objectType;
              break;
          }
        });
        return {
          objectTypes,
          effects: {
            bcs: bytes ?? null,
            digest: effects.transactionDigest,
            version: 2,
            status: effects.status.status === "success" ? { success: true, error: null } : { success: false, error: effects.status.error },
            gasUsed: effects.gasUsed,
            transactionDigest: effects.transactionDigest,
            gasObject: {
              id: effects.gasObject?.reference.objectId,
              inputState: "Exists",
              inputVersion: null,
              inputDigest: null,
              inputOwner: null,
              outputState: "ObjectWrite",
              outputVersion: effects.gasObject.reference.version,
              outputDigest: effects.gasObject.reference.digest,
              outputOwner: parseOwner(effects.gasObject.owner),
              idOperation: "None"
            },
            eventsDigest: effects.eventsDigest ?? null,
            dependencies: effects.dependencies ?? [],
            lamportVersion: effects.gasObject.reference.version,
            changedObjects,
            unchangedConsensusObjects,
            auxiliaryDataDigest: null
          }
        };
      }
      const Balance = suiBcs.struct("Balance", {
        value: suiBcs.u64()
      });
      const Coin = suiBcs.struct("Coin", {
        id: suiBcs.Address,
        balance: Balance
      });
      function parseNormalizedSuiMoveType(type) {
        if (typeof type !== "string") {
          if ("Reference" in type) {
            return {
              reference: "immutable",
              body: parseNormalizedSuiMoveTypeBody(type.Reference)
            };
          }
          if ("MutableReference" in type) {
            return {
              reference: "mutable",
              body: parseNormalizedSuiMoveTypeBody(type.MutableReference)
            };
          }
        }
        return {
          reference: null,
          body: parseNormalizedSuiMoveTypeBody(type)
        };
      }
      function parseNormalizedSuiMoveTypeBody(type) {
        switch (type) {
          case "Address":
            return { $kind: "address" };
          case "Bool":
            return { $kind: "bool" };
          case "U8":
            return { $kind: "u8" };
          case "U16":
            return { $kind: "u16" };
          case "U32":
            return { $kind: "u32" };
          case "U64":
            return { $kind: "u64" };
          case "U128":
            return { $kind: "u128" };
          case "U256":
            return { $kind: "u256" };
        }
        if (typeof type === "string") {
          throw new Error(`Unknown type: ${type}`);
        }
        if ("Vector" in type) {
          return {
            $kind: "vector",
            vector: parseNormalizedSuiMoveTypeBody(type.Vector)
          };
        }
        if ("Struct" in type) {
          return {
            $kind: "datatype",
            datatype: {
              typeName: `${normalizeSuiAddress(type.Struct.address)}::${type.Struct.module}::${type.Struct.name}`,
              typeParameters: type.Struct.typeArguments.map((t) => parseNormalizedSuiMoveTypeBody(t))
            }
          };
        }
        if ("TypeParameter" in type) {
          return {
            $kind: "typeParameter",
            index: type.TypeParameter
          };
        }
        throw new Error(`Unknown type: ${JSON.stringify(type)}`);
      }
      function parseAbilities(abilitySet) {
        return abilitySet.abilities.map((ability) => {
          switch (ability) {
            case "Copy":
              return "copy";
            case "Drop":
              return "drop";
            case "Store":
              return "store";
            case "Key":
              return "key";
            default:
              return "unknown";
          }
        });
      }
      function parseVisibility(visibility) {
        switch (visibility) {
          case "Public":
            return "public";
          case "Private":
            return "private";
          case "Friend":
            return "friend";
          default:
            return "unknown";
        }
      }

      const SUI_CLIENT_BRAND = Symbol.for("@mysten/SuiClient");
      function isSuiJsonRpcClient(client) {
        return typeof client === "object" && client !== null && client[SUI_CLIENT_BRAND] === true;
      }
      class SuiJsonRpcClient extends Experimental_BaseClient {
        /**
         * Establish a connection to a Sui RPC endpoint
         *
         * @param options configuration options for the API Client
         */
        constructor(options) {
          super({ network: options.network ?? "unknown" });
          this.jsonRpc = this;
          this.transport = options.transport ?? new JsonRpcHTTPTransport({ url: options.url });
          this.core = new JSONRpcCoreClient({
            jsonRpcClient: this,
            mvr: options.mvr
          });
        }
        get [SUI_CLIENT_BRAND]() {
          return true;
        }
        async getRpcApiVersion({ signal } = {}) {
          const resp = await this.transport.request({
            method: "rpc.discover",
            params: [],
            signal
          });
          return resp.info.version;
        }
        /**
         * Get all Coin<`coin_type`> objects owned by an address.
         */
        async getCoins({
          coinType,
          owner,
          cursor,
          limit,
          signal
        }) {
          if (!owner || !isValidSuiAddress(normalizeSuiAddress(owner))) {
            throw new Error("Invalid Sui address");
          }
          if (coinType && hasMvrName(coinType)) {
            coinType = (await this.core.mvr.resolveType({
              type: coinType
            })).type;
          }
          return await this.transport.request({
            method: "suix_getCoins",
            params: [owner, coinType, cursor, limit],
            signal
          });
        }
        /**
         * Get all Coin objects owned by an address.
         */
        async getAllCoins(input) {
          if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
            throw new Error("Invalid Sui address");
          }
          return await this.transport.request({
            method: "suix_getAllCoins",
            params: [input.owner, input.cursor, input.limit],
            signal: input.signal
          });
        }
        /**
         * Get the total coin balance for one coin type, owned by the address owner.
         */
        async getBalance({ owner, coinType, signal }) {
          if (!owner || !isValidSuiAddress(normalizeSuiAddress(owner))) {
            throw new Error("Invalid Sui address");
          }
          if (coinType && hasMvrName(coinType)) {
            coinType = (await this.core.mvr.resolveType({
              type: coinType
            })).type;
          }
          return await this.transport.request({
            method: "suix_getBalance",
            params: [owner, coinType],
            signal
          });
        }
        /**
         * Get the total coin balance for all coin types, owned by the address owner.
         */
        async getAllBalances(input) {
          if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
            throw new Error("Invalid Sui address");
          }
          return await this.transport.request({
            method: "suix_getAllBalances",
            params: [input.owner],
            signal: input.signal
          });
        }
        /**
         * Fetch CoinMetadata for a given coin type
         */
        async getCoinMetadata({ coinType, signal }) {
          if (coinType && hasMvrName(coinType)) {
            coinType = (await this.core.mvr.resolveType({
              type: coinType
            })).type;
          }
          return await this.transport.request({
            method: "suix_getCoinMetadata",
            params: [coinType],
            signal
          });
        }
        /**
         *  Fetch total supply for a coin
         */
        async getTotalSupply({ coinType, signal }) {
          if (coinType && hasMvrName(coinType)) {
            coinType = (await this.core.mvr.resolveType({
              type: coinType
            })).type;
          }
          return await this.transport.request({
            method: "suix_getTotalSupply",
            params: [coinType],
            signal
          });
        }
        /**
         * Invoke any RPC method
         * @param method the method to be invoked
         * @param args the arguments to be passed to the RPC request
         */
        async call(method, params, { signal } = {}) {
          return await this.transport.request({ method, params, signal });
        }
        /**
         * Get Move function argument types like read, write and full access
         */
        async getMoveFunctionArgTypes({
          package: pkg,
          module,
          function: fn,
          signal
        }) {
          if (pkg && isValidNamedPackage(pkg)) {
            pkg = (await this.core.mvr.resolvePackage({
              package: pkg
            })).package;
          }
          return await this.transport.request({
            method: "sui_getMoveFunctionArgTypes",
            params: [pkg, module, fn],
            signal
          });
        }
        /**
         * Get a map from module name to
         * structured representations of Move modules
         */
        async getNormalizedMoveModulesByPackage({
          package: pkg,
          signal
        }) {
          if (pkg && isValidNamedPackage(pkg)) {
            pkg = (await this.core.mvr.resolvePackage({
              package: pkg
            })).package;
          }
          return await this.transport.request({
            method: "sui_getNormalizedMoveModulesByPackage",
            params: [pkg],
            signal
          });
        }
        /**
         * Get a structured representation of Move module
         */
        async getNormalizedMoveModule({
          package: pkg,
          module,
          signal
        }) {
          if (pkg && isValidNamedPackage(pkg)) {
            pkg = (await this.core.mvr.resolvePackage({
              package: pkg
            })).package;
          }
          return await this.transport.request({
            method: "sui_getNormalizedMoveModule",
            params: [pkg, module],
            signal
          });
        }
        /**
         * Get a structured representation of Move function
         */
        async getNormalizedMoveFunction({
          package: pkg,
          module,
          function: fn,
          signal
        }) {
          if (pkg && isValidNamedPackage(pkg)) {
            pkg = (await this.core.mvr.resolvePackage({
              package: pkg
            })).package;
          }
          return await this.transport.request({
            method: "sui_getNormalizedMoveFunction",
            params: [pkg, module, fn],
            signal
          });
        }
        /**
         * Get a structured representation of Move struct
         */
        async getNormalizedMoveStruct({
          package: pkg,
          module,
          struct,
          signal
        }) {
          if (pkg && isValidNamedPackage(pkg)) {
            pkg = (await this.core.mvr.resolvePackage({
              package: pkg
            })).package;
          }
          return await this.transport.request({
            method: "sui_getNormalizedMoveStruct",
            params: [pkg, module, struct],
            signal
          });
        }
        /**
         * Get all objects owned by an address
         */
        async getOwnedObjects(input) {
          if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
            throw new Error("Invalid Sui address");
          }
          const filter = input.filter ? {
            ...input.filter
          } : void 0;
          if (filter && "MoveModule" in filter && isValidNamedPackage(filter.MoveModule.package)) {
            filter.MoveModule = {
              module: filter.MoveModule.module,
              package: (await this.core.mvr.resolvePackage({
                package: filter.MoveModule.package
              })).package
            };
          } else if (filter && "StructType" in filter && hasMvrName(filter.StructType)) {
            filter.StructType = (await this.core.mvr.resolveType({
              type: filter.StructType
            })).type;
          }
          return await this.transport.request({
            method: "suix_getOwnedObjects",
            params: [
              input.owner,
              {
                filter,
                options: input.options
              },
              input.cursor,
              input.limit
            ],
            signal: input.signal
          });
        }
        /**
         * Get details about an object
         */
        async getObject(input) {
          if (!input.id || !isValidSuiObjectId(normalizeSuiObjectId(input.id))) {
            throw new Error("Invalid Sui Object id");
          }
          return await this.transport.request({
            method: "sui_getObject",
            params: [input.id, input.options],
            signal: input.signal
          });
        }
        async tryGetPastObject(input) {
          return await this.transport.request({
            method: "sui_tryGetPastObject",
            params: [input.id, input.version, input.options],
            signal: input.signal
          });
        }
        /**
         * Batch get details about a list of objects. If any of the object ids are duplicates the call will fail
         */
        async multiGetObjects(input) {
          input.ids.forEach((id) => {
            if (!id || !isValidSuiObjectId(normalizeSuiObjectId(id))) {
              throw new Error(`Invalid Sui Object id ${id}`);
            }
          });
          const hasDuplicates = input.ids.length !== new Set(input.ids).size;
          if (hasDuplicates) {
            throw new Error(`Duplicate object ids in batch call ${input.ids}`);
          }
          return await this.transport.request({
            method: "sui_multiGetObjects",
            params: [input.ids, input.options],
            signal: input.signal
          });
        }
        /**
         * Get transaction blocks for a given query criteria
         */
        async queryTransactionBlocks({
          filter,
          options,
          cursor,
          limit,
          order,
          signal
        }) {
          if (filter && "MoveFunction" in filter && isValidNamedPackage(filter.MoveFunction.package)) {
            filter = {
              ...filter,
              MoveFunction: {
                package: (await this.core.mvr.resolvePackage({
                  package: filter.MoveFunction.package
                })).package
              }
            };
          }
          return await this.transport.request({
            method: "suix_queryTransactionBlocks",
            params: [
              {
                filter,
                options
              },
              cursor,
              limit,
              (order || "descending") === "descending"
            ],
            signal
          });
        }
        async getTransactionBlock(input) {
          if (!isValidTransactionDigest(input.digest)) {
            throw new Error("Invalid Transaction digest");
          }
          return await this.transport.request({
            method: "sui_getTransactionBlock",
            params: [input.digest, input.options],
            signal: input.signal
          });
        }
        async multiGetTransactionBlocks(input) {
          input.digests.forEach((d) => {
            if (!isValidTransactionDigest(d)) {
              throw new Error(`Invalid Transaction digest ${d}`);
            }
          });
          const hasDuplicates = input.digests.length !== new Set(input.digests).size;
          if (hasDuplicates) {
            throw new Error(`Duplicate digests in batch call ${input.digests}`);
          }
          return await this.transport.request({
            method: "sui_multiGetTransactionBlocks",
            params: [input.digests, input.options],
            signal: input.signal
          });
        }
        async executeTransactionBlock({
          transactionBlock,
          signature,
          options,
          requestType,
          signal
        }) {
          const result = await this.transport.request({
            method: "sui_executeTransactionBlock",
            params: [
              typeof transactionBlock === "string" ? transactionBlock : toBase64(transactionBlock),
              Array.isArray(signature) ? signature : [signature],
              options
            ],
            signal
          });
          if (requestType === "WaitForLocalExecution") {
            try {
              await this.waitForTransaction({
                digest: result.digest
              });
            } catch {
            }
          }
          return result;
        }
        async signAndExecuteTransaction({
          transaction,
          signer,
          ...input
        }) {
          let transactionBytes;
          if (transaction instanceof Uint8Array) {
            transactionBytes = transaction;
          } else {
            transaction.setSenderIfNotSet(signer.toSuiAddress());
            transactionBytes = await transaction.build({ client: this });
          }
          const { signature, bytes } = await signer.signTransaction(transactionBytes);
          return this.executeTransactionBlock({
            transactionBlock: bytes,
            signature,
            ...input
          });
        }
        /**
         * Get total number of transactions
         */
        async getTotalTransactionBlocks({ signal } = {}) {
          const resp = await this.transport.request({
            method: "sui_getTotalTransactionBlocks",
            params: [],
            signal
          });
          return BigInt(resp);
        }
        /**
         * Getting the reference gas price for the network
         */
        async getReferenceGasPrice({ signal } = {}) {
          const resp = await this.transport.request({
            method: "suix_getReferenceGasPrice",
            params: [],
            signal
          });
          return BigInt(resp);
        }
        /**
         * Return the delegated stakes for an address
         */
        async getStakes(input) {
          if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
            throw new Error("Invalid Sui address");
          }
          return await this.transport.request({
            method: "suix_getStakes",
            params: [input.owner],
            signal: input.signal
          });
        }
        /**
         * Return the delegated stakes queried by id.
         */
        async getStakesByIds(input) {
          input.stakedSuiIds.forEach((id) => {
            if (!id || !isValidSuiObjectId(normalizeSuiObjectId(id))) {
              throw new Error(`Invalid Sui Stake id ${id}`);
            }
          });
          return await this.transport.request({
            method: "suix_getStakesByIds",
            params: [input.stakedSuiIds],
            signal: input.signal
          });
        }
        /**
         * Return the latest system state content.
         */
        async getLatestSuiSystemState({
          signal
        } = {}) {
          return await this.transport.request({
            method: "suix_getLatestSuiSystemState",
            params: [],
            signal
          });
        }
        /**
         * Get events for a given query criteria
         */
        async queryEvents({
          query,
          cursor,
          limit,
          order,
          signal
        }) {
          if (query && "MoveEventType" in query && hasMvrName(query.MoveEventType)) {
            query = {
              ...query,
              MoveEventType: (await this.core.mvr.resolveType({
                type: query.MoveEventType
              })).type
            };
          }
          if (query && "MoveEventModule" in query && isValidNamedPackage(query.MoveEventModule.package)) {
            query = {
              ...query,
              MoveEventModule: {
                module: query.MoveEventModule.module,
                package: (await this.core.mvr.resolvePackage({
                  package: query.MoveEventModule.package
                })).package
              }
            };
          }
          if ("MoveModule" in query && isValidNamedPackage(query.MoveModule.package)) {
            query = {
              ...query,
              MoveModule: {
                module: query.MoveModule.module,
                package: (await this.core.mvr.resolvePackage({
                  package: query.MoveModule.package
                })).package
              }
            };
          }
          return await this.transport.request({
            method: "suix_queryEvents",
            params: [query, cursor, limit, (order || "descending") === "descending"],
            signal
          });
        }
        /**
         * Subscribe to get notifications whenever an event matching the filter occurs
         *
         * @deprecated
         */
        async subscribeEvent(input) {
          return this.transport.subscribe({
            method: "suix_subscribeEvent",
            unsubscribe: "suix_unsubscribeEvent",
            params: [input.filter],
            onMessage: input.onMessage,
            signal: input.signal
          });
        }
        /**
         * @deprecated
         */
        async subscribeTransaction(input) {
          return this.transport.subscribe({
            method: "suix_subscribeTransaction",
            unsubscribe: "suix_unsubscribeTransaction",
            params: [input.filter],
            onMessage: input.onMessage,
            signal: input.signal
          });
        }
        /**
         * Runs the transaction block in dev-inspect mode. Which allows for nearly any
         * transaction (or Move call) with any arguments. Detailed results are
         * provided, including both the transaction effects and any return values.
         */
        async devInspectTransactionBlock(input) {
          let devInspectTxBytes;
          if (isTransaction(input.transactionBlock)) {
            input.transactionBlock.setSenderIfNotSet(input.sender);
            devInspectTxBytes = toBase64(
              await input.transactionBlock.build({
                client: this,
                onlyTransactionKind: true
              })
            );
          } else if (typeof input.transactionBlock === "string") {
            devInspectTxBytes = input.transactionBlock;
          } else if (input.transactionBlock instanceof Uint8Array) {
            devInspectTxBytes = toBase64(input.transactionBlock);
          } else {
            throw new Error("Unknown transaction block format.");
          }
          input.signal?.throwIfAborted();
          return await this.transport.request({
            method: "sui_devInspectTransactionBlock",
            params: [input.sender, devInspectTxBytes, input.gasPrice?.toString(), input.epoch],
            signal: input.signal
          });
        }
        /**
         * Dry run a transaction block and return the result.
         */
        async dryRunTransactionBlock(input) {
          return await this.transport.request({
            method: "sui_dryRunTransactionBlock",
            params: [
              typeof input.transactionBlock === "string" ? input.transactionBlock : toBase64(input.transactionBlock)
            ]
          });
        }
        /**
         * Return the list of dynamic field objects owned by an object
         */
        async getDynamicFields(input) {
          if (!input.parentId || !isValidSuiObjectId(normalizeSuiObjectId(input.parentId))) {
            throw new Error("Invalid Sui Object id");
          }
          return await this.transport.request({
            method: "suix_getDynamicFields",
            params: [input.parentId, input.cursor, input.limit],
            signal: input.signal
          });
        }
        /**
         * Return the dynamic field object information for a specified object
         */
        async getDynamicFieldObject(input) {
          return await this.transport.request({
            method: "suix_getDynamicFieldObject",
            params: [input.parentId, input.name],
            signal: input.signal
          });
        }
        /**
         * Get the sequence number of the latest checkpoint that has been executed
         */
        async getLatestCheckpointSequenceNumber({
          signal
        } = {}) {
          const resp = await this.transport.request({
            method: "sui_getLatestCheckpointSequenceNumber",
            params: [],
            signal
          });
          return String(resp);
        }
        /**
         * Returns information about a given checkpoint
         */
        async getCheckpoint(input) {
          return await this.transport.request({
            method: "sui_getCheckpoint",
            params: [input.id],
            signal: input.signal
          });
        }
        /**
         * Returns historical checkpoints paginated
         */
        async getCheckpoints(input) {
          return await this.transport.request({
            method: "sui_getCheckpoints",
            params: [input.cursor, input?.limit, input.descendingOrder],
            signal: input.signal
          });
        }
        /**
         * Return the committee information for the asked epoch
         */
        async getCommitteeInfo(input) {
          return await this.transport.request({
            method: "suix_getCommitteeInfo",
            params: [input?.epoch],
            signal: input?.signal
          });
        }
        async getNetworkMetrics({ signal } = {}) {
          return await this.transport.request({
            method: "suix_getNetworkMetrics",
            params: [],
            signal
          });
        }
        async getAddressMetrics({ signal } = {}) {
          return await this.transport.request({
            method: "suix_getLatestAddressMetrics",
            params: [],
            signal
          });
        }
        async getEpochMetrics(input) {
          return await this.transport.request({
            method: "suix_getEpochMetrics",
            params: [input?.cursor, input?.limit, input?.descendingOrder],
            signal: input?.signal
          });
        }
        async getAllEpochAddressMetrics(input) {
          return await this.transport.request({
            method: "suix_getAllEpochAddressMetrics",
            params: [input?.descendingOrder],
            signal: input?.signal
          });
        }
        /**
         * Return the committee information for the asked epoch
         */
        async getEpochs(input) {
          return await this.transport.request({
            method: "suix_getEpochs",
            params: [input?.cursor, input?.limit, input?.descendingOrder],
            signal: input?.signal
          });
        }
        /**
         * Returns list of top move calls by usage
         */
        async getMoveCallMetrics({ signal } = {}) {
          return await this.transport.request({
            method: "suix_getMoveCallMetrics",
            params: [],
            signal
          });
        }
        /**
         * Return the committee information for the asked epoch
         */
        async getCurrentEpoch({ signal } = {}) {
          return await this.transport.request({
            method: "suix_getCurrentEpoch",
            params: [],
            signal
          });
        }
        /**
         * Return the Validators APYs
         */
        async getValidatorsApy({ signal } = {}) {
          return await this.transport.request({
            method: "suix_getValidatorsApy",
            params: [],
            signal
          });
        }
        // TODO: Migrate this to `sui_getChainIdentifier` once it is widely available.
        async getChainIdentifier({ signal } = {}) {
          const checkpoint = await this.getCheckpoint({ id: "0", signal });
          const bytes = fromBase58(checkpoint.digest);
          return toHex(bytes.slice(0, 4));
        }
        async resolveNameServiceAddress(input) {
          return await this.transport.request({
            method: "suix_resolveNameServiceAddress",
            params: [input.name],
            signal: input.signal
          });
        }
        async resolveNameServiceNames({
          format = "dot",
          ...input
        }) {
          const { nextCursor, hasNextPage, data } = await this.transport.request({
            method: "suix_resolveNameServiceNames",
            params: [input.address, input.cursor, input.limit],
            signal: input.signal
          });
          return {
            hasNextPage,
            nextCursor,
            data: data.map((name) => normalizeSuiNSName(name, format))
          };
        }
        async getProtocolConfig(input) {
          return await this.transport.request({
            method: "sui_getProtocolConfig",
            params: [input?.version],
            signal: input?.signal
          });
        }
        async verifyZkLoginSignature(input) {
          return await this.transport.request({
            method: "sui_verifyZkLoginSignature",
            params: [input.bytes, input.signature, input.intentScope, input.author],
            signal: input.signal
          });
        }
        /**
         * Wait for a transaction block result to be available over the API.
         * This can be used in conjunction with `executeTransactionBlock` to wait for the transaction to
         * be available via the API.
         * This currently polls the `getTransactionBlock` API to check for the transaction.
         */
        async waitForTransaction({
          signal,
          timeout = 60 * 1e3,
          pollInterval = 2 * 1e3,
          ...input
        }) {
          const timeoutSignal = AbortSignal.timeout(timeout);
          const timeoutPromise = new Promise((_, reject) => {
            timeoutSignal.addEventListener("abort", () => reject(timeoutSignal.reason));
          });
          timeoutPromise.catch(() => {
          });
          while (!timeoutSignal.aborted) {
            signal?.throwIfAborted();
            try {
              return await this.getTransactionBlock(input);
            } catch {
              await Promise.race([
                new Promise((resolve) => setTimeout(resolve, pollInterval)),
                timeoutPromise
              ]);
            }
          }
          timeoutSignal.throwIfAborted();
          throw new Error("Unexpected error while waiting for transaction block.");
        }
        experimental_asClientExtension() {
          return {
            name: "jsonRPC",
            register: () => {
              return this;
            }
          };
        }
      } exports("SuiClient", SuiJsonRpcClient);

      var __typeError$4 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$4 = (obj, member, msg) => member.has(obj) || __typeError$4("Cannot " + msg);
      var __privateGet$4 = (obj, member, getter) => (__accessCheck$4(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$4 = (obj, member, value) => member.has(obj) ? __typeError$4("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$3 = (obj, member, value, setter) => (__accessCheck$4(obj, member, "write to private field"), member.set(obj, value), value);
      var _caches, _cache$2, _onEffects;
      class AsyncCache {
        async getObject(id) {
          const [owned, shared] = await Promise.all([
            this.get("OwnedObject", id),
            this.get("SharedOrImmutableObject", id)
          ]);
          return owned ?? shared ?? null;
        }
        async getObjects(ids) {
          return Promise.all(ids.map((id) => this.getObject(id)));
        }
        async addObject(object) {
          if (object.owner) {
            await this.set("OwnedObject", object.objectId, object);
          } else {
            await this.set("SharedOrImmutableObject", object.objectId, object);
          }
          return object;
        }
        async addObjects(objects) {
          await Promise.all(objects.map(async (object) => this.addObject(object)));
        }
        async deleteObject(id) {
          await Promise.all([this.delete("OwnedObject", id), this.delete("SharedOrImmutableObject", id)]);
        }
        async deleteObjects(ids) {
          await Promise.all(ids.map((id) => this.deleteObject(id)));
        }
        async getMoveFunctionDefinition(ref) {
          const functionName = `${normalizeSuiAddress(ref.package)}::${ref.module}::${ref.function}`;
          return this.get("MoveFunction", functionName);
        }
        async addMoveFunctionDefinition(functionEntry) {
          const pkg = normalizeSuiAddress(functionEntry.package);
          const functionName = `${pkg}::${functionEntry.module}::${functionEntry.function}`;
          const entry = {
            ...functionEntry,
            package: pkg
          };
          await this.set("MoveFunction", functionName, entry);
          return entry;
        }
        async deleteMoveFunctionDefinition(ref) {
          const functionName = `${normalizeSuiAddress(ref.package)}::${ref.module}::${ref.function}`;
          await this.delete("MoveFunction", functionName);
        }
        async getCustom(key) {
          return this.get("Custom", key);
        }
        async setCustom(key, value) {
          return this.set("Custom", key, value);
        }
        async deleteCustom(key) {
          return this.delete("Custom", key);
        }
      } exports("AsyncCache", AsyncCache);
      class InMemoryCache extends AsyncCache {
        constructor() {
          super(...arguments);
          __privateAdd$4(this, _caches, {
            OwnedObject: /* @__PURE__ */ new Map(),
            SharedOrImmutableObject: /* @__PURE__ */ new Map(),
            MoveFunction: /* @__PURE__ */ new Map(),
            Custom: /* @__PURE__ */ new Map()
          });
        }
        async get(type, key) {
          return __privateGet$4(this, _caches)[type].get(key) ?? null;
        }
        async set(type, key, value) {
          __privateGet$4(this, _caches)[type].set(key, value);
        }
        async delete(type, key) {
          __privateGet$4(this, _caches)[type].delete(key);
        }
        async clear(type) {
          if (type) {
            __privateGet$4(this, _caches)[type].clear();
          } else {
            for (const cache of Object.values(__privateGet$4(this, _caches))) {
              cache.clear();
            }
          }
        }
      }
      _caches = new WeakMap();
      class ObjectCache {
        constructor({ cache = new InMemoryCache(), onEffects }) {
          __privateAdd$4(this, _cache$2);
          __privateAdd$4(this, _onEffects);
          __privateSet$3(this, _cache$2, cache);
          __privateSet$3(this, _onEffects, onEffects);
        }
        asPlugin() {
          return async (transactionData, _options, next) => {
            const unresolvedObjects = transactionData.inputs.filter((input) => input.UnresolvedObject).map((input) => input.UnresolvedObject.objectId);
            const cached = (await __privateGet$4(this, _cache$2).getObjects(unresolvedObjects)).filter(
              (obj) => obj !== null
            );
            const byId = new Map(cached.map((obj) => [obj.objectId, obj]));
            for (const input of transactionData.inputs) {
              if (!input.UnresolvedObject) {
                continue;
              }
              const cached2 = byId.get(input.UnresolvedObject.objectId);
              if (!cached2) {
                continue;
              }
              if (cached2.initialSharedVersion && !input.UnresolvedObject.initialSharedVersion) {
                input.UnresolvedObject.initialSharedVersion = cached2.initialSharedVersion;
              } else {
                if (cached2.version && !input.UnresolvedObject.version) {
                  input.UnresolvedObject.version = cached2.version;
                }
                if (cached2.digest && !input.UnresolvedObject.digest) {
                  input.UnresolvedObject.digest = cached2.digest;
                }
              }
            }
            await Promise.all(
              transactionData.commands.map(async (commands) => {
                if (commands.MoveCall) {
                  const def = await this.getMoveFunctionDefinition({
                    package: commands.MoveCall.package,
                    module: commands.MoveCall.module,
                    function: commands.MoveCall.function
                  });
                  if (def) {
                    commands.MoveCall._argumentTypes = def.parameters;
                  }
                }
              })
            );
            await next();
            await Promise.all(
              transactionData.commands.map(async (commands) => {
                if (commands.MoveCall?._argumentTypes) {
                  await __privateGet$4(this, _cache$2).addMoveFunctionDefinition({
                    package: commands.MoveCall.package,
                    module: commands.MoveCall.module,
                    function: commands.MoveCall.function,
                    parameters: commands.MoveCall._argumentTypes
                  });
                }
              })
            );
          };
        }
        async clear() {
          await __privateGet$4(this, _cache$2).clear();
        }
        async getMoveFunctionDefinition(ref) {
          return __privateGet$4(this, _cache$2).getMoveFunctionDefinition(ref);
        }
        async getObjects(ids) {
          return __privateGet$4(this, _cache$2).getObjects(ids);
        }
        async deleteObjects(ids) {
          return __privateGet$4(this, _cache$2).deleteObjects(ids);
        }
        async clearOwnedObjects() {
          await __privateGet$4(this, _cache$2).clear("OwnedObject");
        }
        async clearCustom() {
          await __privateGet$4(this, _cache$2).clear("Custom");
        }
        async getCustom(key) {
          return __privateGet$4(this, _cache$2).getCustom(key);
        }
        async setCustom(key, value) {
          return __privateGet$4(this, _cache$2).setCustom(key, value);
        }
        async deleteCustom(key) {
          return __privateGet$4(this, _cache$2).deleteCustom(key);
        }
        async applyEffects(effects) {
          var _a;
          if (!effects.V2) {
            throw new Error(`Unsupported transaction effects version ${effects.$kind}`);
          }
          const { lamportVersion, changedObjects } = effects.V2;
          const deletedIds = [];
          const addedObjects = [];
          changedObjects.forEach(([id, change]) => {
            if (change.outputState.NotExist) {
              deletedIds.push(id);
            } else if (change.outputState.ObjectWrite) {
              const [digest, owner] = change.outputState.ObjectWrite;
              addedObjects.push({
                objectId: id,
                digest,
                version: lamportVersion,
                owner: owner.AddressOwner ?? owner.ObjectOwner ?? null,
                initialSharedVersion: owner.Shared?.initialSharedVersion ?? null
              });
            }
          });
          await Promise.all([
            __privateGet$4(this, _cache$2).addObjects(addedObjects),
            __privateGet$4(this, _cache$2).deleteObjects(deletedIds),
            (_a = __privateGet$4(this, _onEffects)) == null ? void 0 : _a.call(this, effects)
          ]);
        }
      } exports("ObjectCache", ObjectCache);
      _cache$2 = new WeakMap();
      _onEffects = new WeakMap();

      var __typeError$3 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$3 = (obj, member, msg) => member.has(obj) || __typeError$3("Cannot " + msg);
      var __privateGet$3 = (obj, member, getter) => (__accessCheck$3(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$3 = (obj, member, value) => member.has(obj) ? __typeError$3("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$2 = (obj, member, value, setter) => (__accessCheck$3(obj, member, "write to private field"), member.set(obj, value), value);
      var _client$1, _lastDigest$1;
      class CachingTransactionExecutor {
        constructor({
          client,
          ...options
        }) {
          __privateAdd$3(this, _client$1);
          __privateAdd$3(this, _lastDigest$1, null);
          __privateSet$2(this, _client$1, client);
          this.cache = new ObjectCache(options);
        }
        /**
         * Clears all Owned objects
         * Immutable objects, Shared objects, and Move function definitions will be preserved
         */
        async reset() {
          await Promise.all([
            this.cache.clearOwnedObjects(),
            this.cache.clearCustom(),
            this.waitForLastTransaction()
          ]);
        }
        async buildTransaction({
          transaction,
          ...options
        }) {
          transaction.addBuildPlugin(this.cache.asPlugin());
          return transaction.build({
            client: __privateGet$3(this, _client$1),
            ...options
          });
        }
        async executeTransaction({
          transaction,
          options,
          ...input
        }) {
          const bytes = isTransaction(transaction) ? await this.buildTransaction({ transaction }) : transaction;
          const results = await __privateGet$3(this, _client$1).executeTransactionBlock({
            ...input,
            transactionBlock: bytes,
            options: {
              ...options,
              showRawEffects: true
            }
          });
          if (results.rawEffects) {
            const effects = suiBcs.TransactionEffects.parse(Uint8Array.from(results.rawEffects));
            await this.applyEffects(effects);
          }
          return results;
        }
        async signAndExecuteTransaction({
          options,
          transaction,
          ...input
        }) {
          transaction.setSenderIfNotSet(input.signer.toSuiAddress());
          const bytes = await this.buildTransaction({ transaction });
          const { signature } = await input.signer.signTransaction(bytes);
          const results = await this.executeTransaction({
            transaction: bytes,
            signature,
            options
          });
          return results;
        }
        async applyEffects(effects) {
          __privateSet$2(this, _lastDigest$1, effects.V2?.transactionDigest ?? null);
          await this.cache.applyEffects(effects);
        }
        async waitForLastTransaction() {
          if (__privateGet$3(this, _lastDigest$1)) {
            await __privateGet$3(this, _client$1).waitForTransaction({ digest: __privateGet$3(this, _lastDigest$1) });
            __privateSet$2(this, _lastDigest$1, null);
          }
        }
      }
      _client$1 = new WeakMap();
      _lastDigest$1 = new WeakMap();

      var __typeError$2 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$2 = (obj, member, msg) => member.has(obj) || __typeError$2("Cannot " + msg);
      var __privateGet$2 = (obj, member, getter) => (__accessCheck$2(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$2 = (obj, member, value) => member.has(obj) ? __typeError$2("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var _queue$1, _queue2;
      class SerialQueue {
        constructor() {
          __privateAdd$2(this, _queue$1, []);
        }
        async runTask(task) {
          return new Promise((resolve, reject) => {
            __privateGet$2(this, _queue$1).push(() => {
              task().finally(() => {
                __privateGet$2(this, _queue$1).shift();
                if (__privateGet$2(this, _queue$1).length > 0) {
                  __privateGet$2(this, _queue$1)[0]();
                }
              }).then(resolve, reject);
            });
            if (__privateGet$2(this, _queue$1).length === 1) {
              __privateGet$2(this, _queue$1)[0]();
            }
          });
        }
      }
      _queue$1 = new WeakMap();
      class ParallelQueue {
        constructor(maxTasks) {
          __privateAdd$2(this, _queue2, []);
          this.activeTasks = 0;
          this.maxTasks = maxTasks;
        }
        runTask(task) {
          return new Promise((resolve, reject) => {
            if (this.activeTasks < this.maxTasks) {
              this.activeTasks++;
              task().finally(() => {
                if (__privateGet$2(this, _queue2).length > 0) {
                  __privateGet$2(this, _queue2).shift()();
                } else {
                  this.activeTasks--;
                }
              }).then(resolve, reject);
            } else {
              __privateGet$2(this, _queue2).push(() => {
                task().finally(() => {
                  if (__privateGet$2(this, _queue2).length > 0) {
                    __privateGet$2(this, _queue2).shift()();
                  } else {
                    this.activeTasks--;
                  }
                }).then(resolve, reject);
              });
            }
          });
        }
      }
      _queue2 = new WeakMap();

      var __typeError$1 = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck$1 = (obj, member, msg) => member.has(obj) || __typeError$1("Cannot " + msg);
      var __privateGet$1 = (obj, member, getter) => (__accessCheck$1(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
      var __privateAdd$1 = (obj, member, value) => member.has(obj) ? __typeError$1("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet$1 = (obj, member, value, setter) => (__accessCheck$1(obj, member, "write to private field"), member.set(obj, value), value);
      var _queue, _signer$1, _cache$1, _defaultGasBudget$1, _cacheGasCoin, _buildTransaction;
      class SerialTransactionExecutor {
        constructor({
          signer,
          defaultGasBudget = 50000000n,
          ...options
        }) {
          __privateAdd$1(this, _queue, new SerialQueue());
          __privateAdd$1(this, _signer$1);
          __privateAdd$1(this, _cache$1);
          __privateAdd$1(this, _defaultGasBudget$1);
          __privateAdd$1(this, _cacheGasCoin, async (effects) => {
            if (!effects.V2) {
              return;
            }
            const gasCoin = getGasCoinFromEffects(effects).ref;
            if (gasCoin) {
              __privateGet$1(this, _cache$1).cache.setCustom("gasCoin", gasCoin);
            } else {
              __privateGet$1(this, _cache$1).cache.deleteCustom("gasCoin");
            }
          });
          __privateAdd$1(this, _buildTransaction, async (transaction) => {
            const gasCoin = await __privateGet$1(this, _cache$1).cache.getCustom("gasCoin");
            const copy = Transaction.from(transaction);
            if (gasCoin) {
              copy.setGasPayment([gasCoin]);
            }
            copy.setGasBudgetIfNotSet(__privateGet$1(this, _defaultGasBudget$1));
            copy.setSenderIfNotSet(__privateGet$1(this, _signer$1).toSuiAddress());
            return __privateGet$1(this, _cache$1).buildTransaction({ transaction: copy });
          });
          __privateSet$1(this, _signer$1, signer);
          __privateSet$1(this, _defaultGasBudget$1, defaultGasBudget);
          __privateSet$1(this, _cache$1, new CachingTransactionExecutor({
            client: options.client,
            cache: options.cache,
            onEffects: (effects) => __privateGet$1(this, _cacheGasCoin).call(this, effects)
          }));
        }
        async applyEffects(effects) {
          return __privateGet$1(this, _cache$1).applyEffects(effects);
        }
        async buildTransaction(transaction) {
          return __privateGet$1(this, _queue).runTask(() => __privateGet$1(this, _buildTransaction).call(this, transaction));
        }
        resetCache() {
          return __privateGet$1(this, _cache$1).reset();
        }
        waitForLastTransaction() {
          return __privateGet$1(this, _cache$1).waitForLastTransaction();
        }
        executeTransaction(transaction, options, additionalSignatures = []) {
          return __privateGet$1(this, _queue).runTask(async () => {
            const bytes = isTransaction(transaction) ? await __privateGet$1(this, _buildTransaction).call(this, transaction) : transaction;
            const { signature } = await __privateGet$1(this, _signer$1).signTransaction(bytes);
            const results = await __privateGet$1(this, _cache$1).executeTransaction({
              signature: [signature, ...additionalSignatures],
              transaction: bytes,
              options
            }).catch(async (error) => {
              await this.resetCache();
              throw error;
            });
            const effectsBytes = Uint8Array.from(results.rawEffects);
            return {
              digest: results.digest,
              effects: toBase64(effectsBytes),
              data: results
            };
          });
        }
      } exports("SerialTransactionExecutor", SerialTransactionExecutor);
      _queue = new WeakMap();
      _signer$1 = new WeakMap();
      _cache$1 = new WeakMap();
      _defaultGasBudget$1 = new WeakMap();
      _cacheGasCoin = new WeakMap();
      _buildTransaction = new WeakMap();
      function getGasCoinFromEffects(effects) {
        if (!effects.V2) {
          throw new Error("Unexpected effects version");
        }
        const gasObjectChange = effects.V2.changedObjects[effects.V2.gasObjectIndex];
        if (!gasObjectChange) {
          throw new Error("Gas object not found in effects");
        }
        const [objectId, { outputState }] = gasObjectChange;
        if (!outputState.ObjectWrite) {
          throw new Error("Unexpected gas object state");
        }
        const [digest, owner] = outputState.ObjectWrite;
        return {
          ref: {
            objectId,
            digest,
            version: effects.V2.lamportVersion
          },
          owner: owner.AddressOwner || owner.ObjectOwner
        };
      }

      var __typeError = (msg) => {
        throw TypeError(msg);
      };
      var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
      var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), member.get(obj));
      var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
      var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), member.set(obj, value), value);
      var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
      var __privateWrapper = (obj, member, setter, getter) => ({
        set _(value) {
          __privateSet(obj, member, value);
        },
        get _() {
          return __privateGet(obj, member);
        }
      });
      var _signer, _client, _coinBatchSize, _initialCoinBalance, _minimumCoinBalance, _epochBoundaryWindow, _defaultGasBudget, _maxPoolSize, _sourceCoins, _coinPool, _cache, _objectIdQueues, _buildQueue, _executeQueue, _lastDigest, _cacheLock, _pendingTransactions, _gasPrice, _ParallelTransactionExecutor_instances, getUsedObjects_fn, execute_fn, updateCache_fn, waitForLastDigest_fn, getGasCoin_fn, getGasPrice_fn, refillCoinPool_fn;
      const PARALLEL_EXECUTOR_DEFAULTS = {
        coinBatchSize: 20,
        initialCoinBalance: 200000000n,
        minimumCoinBalance: 50000000n,
        maxPoolSize: 50,
        epochBoundaryWindow: 1e3
      };
      class ParallelTransactionExecutor {
        constructor(options) {
          __privateAdd(this, _ParallelTransactionExecutor_instances);
          __privateAdd(this, _signer);
          __privateAdd(this, _client);
          __privateAdd(this, _coinBatchSize);
          __privateAdd(this, _initialCoinBalance);
          __privateAdd(this, _minimumCoinBalance);
          __privateAdd(this, _epochBoundaryWindow);
          __privateAdd(this, _defaultGasBudget);
          __privateAdd(this, _maxPoolSize);
          __privateAdd(this, _sourceCoins);
          __privateAdd(this, _coinPool, []);
          __privateAdd(this, _cache);
          __privateAdd(this, _objectIdQueues, /* @__PURE__ */ new Map());
          __privateAdd(this, _buildQueue, new SerialQueue());
          __privateAdd(this, _executeQueue);
          __privateAdd(this, _lastDigest, null);
          __privateAdd(this, _cacheLock, null);
          __privateAdd(this, _pendingTransactions, 0);
          __privateAdd(this, _gasPrice, null);
          __privateSet(this, _signer, options.signer);
          __privateSet(this, _client, options.client);
          __privateSet(this, _coinBatchSize, options.coinBatchSize ?? PARALLEL_EXECUTOR_DEFAULTS.coinBatchSize);
          __privateSet(this, _initialCoinBalance, options.initialCoinBalance ?? PARALLEL_EXECUTOR_DEFAULTS.initialCoinBalance);
          __privateSet(this, _minimumCoinBalance, options.minimumCoinBalance ?? PARALLEL_EXECUTOR_DEFAULTS.minimumCoinBalance);
          __privateSet(this, _defaultGasBudget, options.defaultGasBudget ?? __privateGet(this, _minimumCoinBalance));
          __privateSet(this, _epochBoundaryWindow, options.epochBoundaryWindow ?? PARALLEL_EXECUTOR_DEFAULTS.epochBoundaryWindow);
          __privateSet(this, _maxPoolSize, options.maxPoolSize ?? PARALLEL_EXECUTOR_DEFAULTS.maxPoolSize);
          __privateSet(this, _cache, new CachingTransactionExecutor({
            client: options.client,
            cache: options.cache
          }));
          __privateSet(this, _executeQueue, new ParallelQueue(__privateGet(this, _maxPoolSize)));
          __privateSet(this, _sourceCoins, options.sourceCoins ? new Map(options.sourceCoins.map((id) => [id, null])) : null);
        }
        resetCache() {
          __privateSet(this, _gasPrice, null);
          return __privateMethod(this, _ParallelTransactionExecutor_instances, updateCache_fn).call(this, () => __privateGet(this, _cache).reset());
        }
        async waitForLastTransaction() {
          await __privateMethod(this, _ParallelTransactionExecutor_instances, updateCache_fn).call(this, () => __privateMethod(this, _ParallelTransactionExecutor_instances, waitForLastDigest_fn).call(this));
        }
        async executeTransaction(transaction, options, additionalSignatures = []) {
          const { promise, resolve, reject } = promiseWithResolvers();
          const usedObjects = await __privateMethod(this, _ParallelTransactionExecutor_instances, getUsedObjects_fn).call(this, transaction);
          const execute = () => {
            __privateGet(this, _executeQueue).runTask(() => {
              const promise2 = __privateMethod(this, _ParallelTransactionExecutor_instances, execute_fn).call(this, transaction, usedObjects, options, additionalSignatures);
              return promise2.then(resolve, reject);
            });
          };
          const conflicts = /* @__PURE__ */ new Set();
          usedObjects.forEach((objectId) => {
            const queue = __privateGet(this, _objectIdQueues).get(objectId);
            if (queue) {
              conflicts.add(objectId);
              __privateGet(this, _objectIdQueues).get(objectId).push(() => {
                conflicts.delete(objectId);
                if (conflicts.size === 0) {
                  execute();
                }
              });
            } else {
              __privateGet(this, _objectIdQueues).set(objectId, []);
            }
          });
          if (conflicts.size === 0) {
            execute();
          }
          return promise;
        }
      } exports("ParallelTransactionExecutor", ParallelTransactionExecutor);
      _signer = new WeakMap();
      _client = new WeakMap();
      _coinBatchSize = new WeakMap();
      _initialCoinBalance = new WeakMap();
      _minimumCoinBalance = new WeakMap();
      _epochBoundaryWindow = new WeakMap();
      _defaultGasBudget = new WeakMap();
      _maxPoolSize = new WeakMap();
      _sourceCoins = new WeakMap();
      _coinPool = new WeakMap();
      _cache = new WeakMap();
      _objectIdQueues = new WeakMap();
      _buildQueue = new WeakMap();
      _executeQueue = new WeakMap();
      _lastDigest = new WeakMap();
      _cacheLock = new WeakMap();
      _pendingTransactions = new WeakMap();
      _gasPrice = new WeakMap();
      _ParallelTransactionExecutor_instances = new WeakSet();
      getUsedObjects_fn = async function(transaction) {
        const usedObjects = /* @__PURE__ */ new Set();
        let serialized = false;
        transaction.addSerializationPlugin(async (blockData, _options, next) => {
          await next();
          if (serialized) {
            return;
          }
          serialized = true;
          blockData.inputs.forEach((input) => {
            if (input.Object?.ImmOrOwnedObject?.objectId) {
              usedObjects.add(input.Object.ImmOrOwnedObject.objectId);
            } else if (input.Object?.Receiving?.objectId) {
              usedObjects.add(input.Object.Receiving.objectId);
            } else if (input.UnresolvedObject?.objectId && !input.UnresolvedObject.initialSharedVersion) {
              usedObjects.add(input.UnresolvedObject.objectId);
            }
          });
        });
        await transaction.prepareForSerialization({ client: __privateGet(this, _client) });
        return usedObjects;
      };
      execute_fn = async function(transaction, usedObjects, options, additionalSignatures = []) {
        let gasCoin;
        try {
          transaction.setSenderIfNotSet(__privateGet(this, _signer).toSuiAddress());
          await __privateGet(this, _buildQueue).runTask(async () => {
            const data = transaction.getData();
            if (!data.gasData.price) {
              transaction.setGasPrice(await __privateMethod(this, _ParallelTransactionExecutor_instances, getGasPrice_fn).call(this));
            }
            transaction.setGasBudgetIfNotSet(__privateGet(this, _defaultGasBudget));
            await __privateMethod(this, _ParallelTransactionExecutor_instances, updateCache_fn).call(this);
            gasCoin = await __privateMethod(this, _ParallelTransactionExecutor_instances, getGasCoin_fn).call(this);
            __privateWrapper(this, _pendingTransactions)._++;
            transaction.setGasPayment([
              {
                objectId: gasCoin.id,
                version: gasCoin.version,
                digest: gasCoin.digest
              }
            ]);
            await __privateGet(this, _cache).buildTransaction({ transaction, onlyTransactionKind: true });
          });
          const bytes = await transaction.build({ client: __privateGet(this, _client) });
          const { signature } = await __privateGet(this, _signer).signTransaction(bytes);
          const results = await __privateGet(this, _cache).executeTransaction({
            transaction: bytes,
            signature: [signature, ...additionalSignatures],
            options: {
              ...options,
              showEffects: true
            }
          });
          const effectsBytes = Uint8Array.from(results.rawEffects);
          const effects = suiBcs.TransactionEffects.parse(effectsBytes);
          const gasResult = getGasCoinFromEffects(effects);
          const gasUsed = effects.V2?.gasUsed;
          if (gasCoin && gasUsed && gasResult.owner === __privateGet(this, _signer).toSuiAddress()) {
            const totalUsed = BigInt(gasUsed.computationCost) + BigInt(gasUsed.storageCost) + BigInt(gasUsed.storageCost) - BigInt(gasUsed.storageRebate);
            const remainingBalance = gasCoin.balance - totalUsed;
            let usesGasCoin = false;
            new TransactionDataBuilder(transaction.getData()).mapArguments((arg) => {
              if (arg.$kind === "GasCoin") {
                usesGasCoin = true;
              }
              return arg;
            });
            if (!usesGasCoin && remainingBalance >= __privateGet(this, _minimumCoinBalance)) {
              __privateGet(this, _coinPool).push({
                id: gasResult.ref.objectId,
                version: gasResult.ref.version,
                digest: gasResult.ref.digest,
                balance: remainingBalance
              });
            } else {
              if (!__privateGet(this, _sourceCoins)) {
                __privateSet(this, _sourceCoins, /* @__PURE__ */ new Map());
              }
              __privateGet(this, _sourceCoins).set(gasResult.ref.objectId, gasResult.ref);
            }
          }
          __privateSet(this, _lastDigest, results.digest);
          return {
            digest: results.digest,
            effects: toBase64(effectsBytes),
            data: results
          };
        } catch (error) {
          if (gasCoin) {
            if (!__privateGet(this, _sourceCoins)) {
              __privateSet(this, _sourceCoins, /* @__PURE__ */ new Map());
            }
            __privateGet(this, _sourceCoins).set(gasCoin.id, null);
          }
          await __privateMethod(this, _ParallelTransactionExecutor_instances, updateCache_fn).call(this, async () => {
            await Promise.all([
              __privateGet(this, _cache).cache.deleteObjects([...usedObjects]),
              __privateMethod(this, _ParallelTransactionExecutor_instances, waitForLastDigest_fn).call(this)
            ]);
          });
          throw error;
        } finally {
          usedObjects.forEach((objectId) => {
            const queue = __privateGet(this, _objectIdQueues).get(objectId);
            if (queue && queue.length > 0) {
              queue.shift()();
            } else if (queue) {
              __privateGet(this, _objectIdQueues).delete(objectId);
            }
          });
          __privateWrapper(this, _pendingTransactions)._--;
        }
      };
      updateCache_fn = async function(fn) {
        if (__privateGet(this, _cacheLock)) {
          await __privateGet(this, _cacheLock);
        }
        __privateSet(this, _cacheLock, fn?.().then(
          () => {
            __privateSet(this, _cacheLock, null);
          },
          () => {
          }
        ) ?? null);
      };
      waitForLastDigest_fn = async function() {
        const digest = __privateGet(this, _lastDigest);
        if (digest) {
          __privateSet(this, _lastDigest, null);
          await __privateGet(this, _client).waitForTransaction({ digest });
        }
      };
      getGasCoin_fn = async function() {
        if (__privateGet(this, _coinPool).length === 0 && __privateGet(this, _pendingTransactions) <= __privateGet(this, _maxPoolSize)) {
          await __privateMethod(this, _ParallelTransactionExecutor_instances, refillCoinPool_fn).call(this);
        }
        if (__privateGet(this, _coinPool).length === 0) {
          throw new Error("No coins available");
        }
        const coin = __privateGet(this, _coinPool).shift();
        return coin;
      };
      getGasPrice_fn = async function() {
        const remaining = __privateGet(this, _gasPrice) ? __privateGet(this, _gasPrice).expiration - __privateGet(this, _epochBoundaryWindow) - Date.now() : 0;
        if (remaining > 0) {
          return __privateGet(this, _gasPrice).price;
        }
        if (__privateGet(this, _gasPrice)) {
          const timeToNextEpoch = Math.max(
            __privateGet(this, _gasPrice).expiration + __privateGet(this, _epochBoundaryWindow) - Date.now(),
            1e3
          );
          await new Promise((resolve) => setTimeout(resolve, timeToNextEpoch));
        }
        const state = await __privateGet(this, _client).getLatestSuiSystemState();
        __privateSet(this, _gasPrice, {
          price: BigInt(state.referenceGasPrice),
          expiration: Number.parseInt(state.epochStartTimestampMs, 10) + Number.parseInt(state.epochDurationMs, 10)
        });
        return __privateMethod(this, _ParallelTransactionExecutor_instances, getGasPrice_fn).call(this);
      };
      refillCoinPool_fn = async function() {
        const batchSize = Math.min(
          __privateGet(this, _coinBatchSize),
          __privateGet(this, _maxPoolSize) - (__privateGet(this, _coinPool).length + __privateGet(this, _pendingTransactions)) + 1
        );
        if (batchSize === 0) {
          return;
        }
        const txb = new Transaction();
        const address = __privateGet(this, _signer).toSuiAddress();
        txb.setSender(address);
        if (__privateGet(this, _sourceCoins)) {
          const refs = [];
          const ids = [];
          for (const [id, ref] of __privateGet(this, _sourceCoins)) {
            if (ref) {
              refs.push(ref);
            } else {
              ids.push(id);
            }
          }
          if (ids.length > 0) {
            const coins = await __privateGet(this, _client).multiGetObjects({
              ids
            });
            refs.push(
              ...coins.filter((coin) => coin.data !== null).map(({ data }) => ({
                objectId: data.objectId,
                version: data.version,
                digest: data.digest
              }))
            );
          }
          txb.setGasPayment(refs);
          __privateSet(this, _sourceCoins, /* @__PURE__ */ new Map());
        }
        const amounts = new Array(batchSize).fill(__privateGet(this, _initialCoinBalance));
        const results = txb.splitCoins(txb.gas, amounts);
        const coinResults = [];
        for (let i = 0; i < amounts.length; i++) {
          coinResults.push(results[i]);
        }
        txb.transferObjects(coinResults, address);
        await this.waitForLastTransaction();
        const result = await __privateGet(this, _client).signAndExecuteTransaction({
          transaction: txb,
          signer: __privateGet(this, _signer),
          options: {
            showRawEffects: true
          }
        });
        const effects = suiBcs.TransactionEffects.parse(Uint8Array.from(result.rawEffects));
        effects.V2?.changedObjects.forEach(([id, { outputState }], i) => {
          if (i === effects.V2?.gasObjectIndex || !outputState.ObjectWrite) {
            return;
          }
          __privateGet(this, _coinPool).push({
            id,
            version: effects.V2.lamportVersion,
            digest: outputState.ObjectWrite[0],
            balance: BigInt(__privateGet(this, _initialCoinBalance))
          });
        });
        if (!__privateGet(this, _sourceCoins)) {
          __privateSet(this, _sourceCoins, /* @__PURE__ */ new Map());
        }
        const gasObject = getGasCoinFromEffects(effects).ref;
        __privateGet(this, _sourceCoins).set(gasObject.objectId, gasObject);
        await __privateGet(this, _client).waitForTransaction({ digest: result.digest });
      };

      const COIN_WITH_BALANCE = "CoinWithBalance";
      const SUI_TYPE = normalizeStructTag("0x2::sui::SUI");
      function coinWithBalance({
        type = SUI_TYPE,
        balance,
        useGasCoin = true
      }) {
        let coinResult = null;
        return (tx) => {
          if (coinResult) {
            return coinResult;
          }
          tx.addIntentResolver(COIN_WITH_BALANCE, resolveCoinBalance);
          const coinType = type === "gas" ? type : normalizeStructTag(type);
          coinResult = tx.add(
            Commands.Intent({
              name: COIN_WITH_BALANCE,
              inputs: {},
              data: {
                type: coinType === SUI_TYPE && useGasCoin ? "gas" : coinType,
                balance: BigInt(balance)
              }
            })
          );
          return coinResult;
        };
      }
      const CoinWithBalanceData = object({
        type: string(),
        balance: bigint()
      });
      async function resolveCoinBalance(transactionData, buildOptions, next) {
        const coinTypes = /* @__PURE__ */ new Set();
        const totalByType = /* @__PURE__ */ new Map();
        if (!transactionData.sender) {
          throw new Error("Sender must be set to resolve CoinWithBalance");
        }
        for (const command of transactionData.commands) {
          if (command.$kind === "$Intent" && command.$Intent.name === COIN_WITH_BALANCE) {
            const { type, balance } = parse(CoinWithBalanceData, command.$Intent.data);
            if (type !== "gas" && balance > 0n) {
              coinTypes.add(type);
            }
            totalByType.set(type, (totalByType.get(type) ?? 0n) + balance);
          }
        }
        const usedIds = /* @__PURE__ */ new Set();
        for (const input of transactionData.inputs) {
          if (input.Object?.ImmOrOwnedObject) {
            usedIds.add(input.Object.ImmOrOwnedObject.objectId);
          }
          if (input.UnresolvedObject?.objectId) {
            usedIds.add(input.UnresolvedObject.objectId);
          }
        }
        const coinsByType = /* @__PURE__ */ new Map();
        const client = getSuiClient(buildOptions);
        await Promise.all(
          [...coinTypes].map(async (coinType) => {
            coinsByType.set(
              coinType,
              await getCoinsOfType({
                coinType,
                balance: totalByType.get(coinType),
                client,
                owner: transactionData.sender,
                usedIds
              })
            );
          })
        );
        const mergedCoins = /* @__PURE__ */ new Map();
        mergedCoins.set("gas", { $kind: "GasCoin", GasCoin: true });
        for (const [index, transaction] of transactionData.commands.entries()) {
          if (transaction.$kind !== "$Intent" || transaction.$Intent.name !== COIN_WITH_BALANCE) {
            continue;
          }
          const { type, balance } = transaction.$Intent.data;
          if (balance === 0n && type !== "gas") {
            transactionData.replaceCommand(
              index,
              Commands.MoveCall({ target: "0x2::coin::zero", typeArguments: [type] })
            );
            continue;
          }
          const commands = [];
          if (!mergedCoins.has(type)) {
            const [first, ...rest] = coinsByType.get(type).map(
              (coin) => transactionData.addInput(
                "object",
                Inputs.ObjectRef({
                  objectId: coin.coinObjectId,
                  digest: coin.digest,
                  version: coin.version
                })
              )
            );
            if (rest.length > 0) {
              commands.push(Commands.MergeCoins(first, rest));
            }
            mergedCoins.set(type, first);
          }
          commands.push(
            Commands.SplitCoins(mergedCoins.get(type), [
              transactionData.addInput("pure", Inputs.Pure(suiBcs.u64().serialize(balance)))
            ])
          );
          transactionData.replaceCommand(index, commands);
          transactionData.mapArguments((arg) => {
            if (arg.$kind === "Result" && arg.Result === index) {
              return {
                $kind: "NestedResult",
                NestedResult: [index + commands.length - 1, 0]
              };
            }
            return arg;
          });
        }
        return next();
      }
      async function getCoinsOfType({
        coinType,
        balance,
        client,
        owner,
        usedIds
      }) {
        let remainingBalance = balance;
        const coins = [];
        return loadMoreCoins();
        async function loadMoreCoins(cursor = null) {
          const { data, hasNextPage, nextCursor } = await client.getCoins({ owner, coinType, cursor });
          const sortedCoins = data.sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));
          for (const coin of sortedCoins) {
            if (usedIds.has(coin.coinObjectId)) {
              continue;
            }
            const coinBalance = BigInt(coin.balance);
            coins.push(coin);
            remainingBalance -= coinBalance;
            if (remainingBalance <= 0) {
              return coins;
            }
          }
          if (hasNextPage) {
            return loadMoreCoins(nextCursor);
          }
          throw new Error(`Not enough coins of type ${coinType} to satisfy requested balance`);
        }
      }
      function getSuiClient(options) {
        const client = getClient$1(options);
        if (!client.jsonRpc) {
          throw new Error(`CoinWithBalance intent currently only works with SuiClient`);
        }
        return client;
      }

      const Arguments = exports("Arguments", {
        pure: createPure((value) => (tx) => tx.pure(value)),
        object: createObjectMethods((value) => (tx) => tx.object(value)),
        sharedObjectRef: (...args) => (tx) => tx.sharedObjectRef(...args),
        objectRef: (...args) => (tx) => tx.objectRef(...args),
        receivingRef: (...args) => (tx) => tx.receivingRef(...args)
      });

      /**
       * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
       * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
       * Check out [RFC 4634](https://datatracker.ietf.org/doc/html/rfc4634) and
       * [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
       * @module
       */
      // SHA2-512 is slower than sha256 in js because u64 operations are slow.
      // Round contants
      // First 32 bits of the fractional parts of the cube roots of the first 80 primes 2..409
      // prettier-ignore
      const K512 = /* @__PURE__ */ (() => split([
          '0x428a2f98d728ae22', '0x7137449123ef65cd', '0xb5c0fbcfec4d3b2f', '0xe9b5dba58189dbbc',
          '0x3956c25bf348b538', '0x59f111f1b605d019', '0x923f82a4af194f9b', '0xab1c5ed5da6d8118',
          '0xd807aa98a3030242', '0x12835b0145706fbe', '0x243185be4ee4b28c', '0x550c7dc3d5ffb4e2',
          '0x72be5d74f27b896f', '0x80deb1fe3b1696b1', '0x9bdc06a725c71235', '0xc19bf174cf692694',
          '0xe49b69c19ef14ad2', '0xefbe4786384f25e3', '0x0fc19dc68b8cd5b5', '0x240ca1cc77ac9c65',
          '0x2de92c6f592b0275', '0x4a7484aa6ea6e483', '0x5cb0a9dcbd41fbd4', '0x76f988da831153b5',
          '0x983e5152ee66dfab', '0xa831c66d2db43210', '0xb00327c898fb213f', '0xbf597fc7beef0ee4',
          '0xc6e00bf33da88fc2', '0xd5a79147930aa725', '0x06ca6351e003826f', '0x142929670a0e6e70',
          '0x27b70a8546d22ffc', '0x2e1b21385c26c926', '0x4d2c6dfc5ac42aed', '0x53380d139d95b3df',
          '0x650a73548baf63de', '0x766a0abb3c77b2a8', '0x81c2c92e47edaee6', '0x92722c851482353b',
          '0xa2bfe8a14cf10364', '0xa81a664bbc423001', '0xc24b8b70d0f89791', '0xc76c51a30654be30',
          '0xd192e819d6ef5218', '0xd69906245565a910', '0xf40e35855771202a', '0x106aa07032bbd1b8',
          '0x19a4c116b8d2d0c8', '0x1e376c085141ab53', '0x2748774cdf8eeb99', '0x34b0bcb5e19b48a8',
          '0x391c0cb3c5c95a63', '0x4ed8aa4ae3418acb', '0x5b9cca4f7763e373', '0x682e6ff3d6b2b8a3',
          '0x748f82ee5defb2fc', '0x78a5636f43172f60', '0x84c87814a1f0ab72', '0x8cc702081a6439ec',
          '0x90befffa23631e28', '0xa4506cebde82bde9', '0xbef9a3f7b2c67915', '0xc67178f2e372532b',
          '0xca273eceea26619c', '0xd186b8c721c0c207', '0xeada7dd6cde0eb1e', '0xf57d4f7fee6ed178',
          '0x06f067aa72176fba', '0x0a637dc5a2c898a6', '0x113f9804bef90dae', '0x1b710b35131c471b',
          '0x28db77f523047d84', '0x32caab7b40c72493', '0x3c9ebe0a15c9bebc', '0x431d67c49c100d4c',
          '0x4cc5d4becb3e42b6', '0x597f299cfc657e2a', '0x5fcb6fab3ad6faec', '0x6c44198c4a475817'
      ].map(n => BigInt(n))))();
      const SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
      const SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
      // Reusable temporary buffers
      const SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
      const SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
      class SHA512 extends HashMD {
          constructor(outputLen = 64) {
              super(128, outputLen, 16, false);
              // We cannot use array here since array allows indexing by variable
              // which means optimizer/compiler cannot use registers.
              // h -- high 32 bits, l -- low 32 bits
              this.Ah = SHA512_IV[0] | 0;
              this.Al = SHA512_IV[1] | 0;
              this.Bh = SHA512_IV[2] | 0;
              this.Bl = SHA512_IV[3] | 0;
              this.Ch = SHA512_IV[4] | 0;
              this.Cl = SHA512_IV[5] | 0;
              this.Dh = SHA512_IV[6] | 0;
              this.Dl = SHA512_IV[7] | 0;
              this.Eh = SHA512_IV[8] | 0;
              this.El = SHA512_IV[9] | 0;
              this.Fh = SHA512_IV[10] | 0;
              this.Fl = SHA512_IV[11] | 0;
              this.Gh = SHA512_IV[12] | 0;
              this.Gl = SHA512_IV[13] | 0;
              this.Hh = SHA512_IV[14] | 0;
              this.Hl = SHA512_IV[15] | 0;
          }
          // prettier-ignore
          get() {
              const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
              return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
          }
          // prettier-ignore
          set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
              this.Ah = Ah | 0;
              this.Al = Al | 0;
              this.Bh = Bh | 0;
              this.Bl = Bl | 0;
              this.Ch = Ch | 0;
              this.Cl = Cl | 0;
              this.Dh = Dh | 0;
              this.Dl = Dl | 0;
              this.Eh = Eh | 0;
              this.El = El | 0;
              this.Fh = Fh | 0;
              this.Fl = Fl | 0;
              this.Gh = Gh | 0;
              this.Gl = Gl | 0;
              this.Hh = Hh | 0;
              this.Hl = Hl | 0;
          }
          process(view, offset) {
              // Extend the first 16 words into the remaining 64 words w[16..79] of the message schedule array
              for (let i = 0; i < 16; i++, offset += 4) {
                  SHA512_W_H[i] = view.getUint32(offset);
                  SHA512_W_L[i] = view.getUint32((offset += 4));
              }
              for (let i = 16; i < 80; i++) {
                  // s0 := (w[i-15] rightrotate 1) xor (w[i-15] rightrotate 8) xor (w[i-15] rightshift 7)
                  const W15h = SHA512_W_H[i - 15] | 0;
                  const W15l = SHA512_W_L[i - 15] | 0;
                  const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
                  const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
                  // s1 := (w[i-2] rightrotate 19) xor (w[i-2] rightrotate 61) xor (w[i-2] rightshift 6)
                  const W2h = SHA512_W_H[i - 2] | 0;
                  const W2l = SHA512_W_L[i - 2] | 0;
                  const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
                  const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
                  // SHA256_W[i] = s0 + s1 + SHA256_W[i - 7] + SHA256_W[i - 16];
                  const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
                  const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
                  SHA512_W_H[i] = SUMh | 0;
                  SHA512_W_L[i] = SUMl | 0;
              }
              let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
              // Compression function main loop, 80 rounds
              for (let i = 0; i < 80; i++) {
                  // S1 := (e rightrotate 14) xor (e rightrotate 18) xor (e rightrotate 41)
                  const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
                  const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
                  //const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
                  const CHIh = (Eh & Fh) ^ (~Eh & Gh);
                  const CHIl = (El & Fl) ^ (~El & Gl);
                  // T1 = H + sigma1 + Chi(E, F, G) + SHA512_K[i] + SHA512_W[i]
                  // prettier-ignore
                  const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
                  const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
                  const T1l = T1ll | 0;
                  // S0 := (a rightrotate 28) xor (a rightrotate 34) xor (a rightrotate 39)
                  const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
                  const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
                  const MAJh = (Ah & Bh) ^ (Ah & Ch) ^ (Bh & Ch);
                  const MAJl = (Al & Bl) ^ (Al & Cl) ^ (Bl & Cl);
                  Hh = Gh | 0;
                  Hl = Gl | 0;
                  Gh = Fh | 0;
                  Gl = Fl | 0;
                  Fh = Eh | 0;
                  Fl = El | 0;
                  ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
                  Dh = Ch | 0;
                  Dl = Cl | 0;
                  Ch = Bh | 0;
                  Cl = Bl | 0;
                  Bh = Ah | 0;
                  Bl = Al | 0;
                  const All = add3L(T1l, sigma0l, MAJl);
                  Ah = add3H(All, T1h, sigma0h, MAJh);
                  Al = All | 0;
              }
              // Add the compressed chunk to the current hash value
              ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
              ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
              ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
              ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
              ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
              ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
              ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
              ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
              this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
          }
          roundClean() {
              clean(SHA512_W_H, SHA512_W_L);
          }
          destroy() {
              clean(this.buffer);
              this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
          }
      }
      /** SHA2-512 hash function from RFC 4634. */
      const sha512$1 = /* @__PURE__ */ createHasher(() => new SHA512());

      /**
       * Hex, bytes and number utilities.
       * @module
       */
      /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
      const _0n$3 = /* @__PURE__ */ BigInt(0);
      const _1n$4 = /* @__PURE__ */ BigInt(1);
      function abool(title, value) {
          if (typeof value !== 'boolean')
              throw new Error(title + ' boolean expected, got ' + value);
      }
      function hexToNumber(hex) {
          if (typeof hex !== 'string')
              throw new Error('hex string expected, got ' + typeof hex);
          return hex === '' ? _0n$3 : BigInt('0x' + hex); // Big Endian
      }
      // BE: Big Endian, LE: Little Endian
      function bytesToNumberBE(bytes) {
          return hexToNumber(bytesToHex(bytes));
      }
      function bytesToNumberLE(bytes) {
          abytes(bytes);
          return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
      }
      function numberToBytesBE(n, len) {
          return hexToBytes(n.toString(16).padStart(len * 2, '0'));
      }
      function numberToBytesLE(n, len) {
          return numberToBytesBE(n, len).reverse();
      }
      /**
       * Takes hex string or Uint8Array, converts to Uint8Array.
       * Validates output length.
       * Will throw error for other types.
       * @param title descriptive title for an error e.g. 'secret key'
       * @param hex hex string or Uint8Array
       * @param expectedLength optional, will compare to result array's length
       * @returns
       */
      function ensureBytes(title, hex, expectedLength) {
          let res;
          if (typeof hex === 'string') {
              try {
                  res = hexToBytes(hex);
              }
              catch (e) {
                  throw new Error(title + ' must be hex string or Uint8Array, cause: ' + e);
              }
          }
          else if (isBytes(hex)) {
              // Uint8Array.from() instead of hash.slice() because node.js Buffer
              // is instance of Uint8Array, and its slice() creates **mutable** copy
              res = Uint8Array.from(hex);
          }
          else {
              throw new Error(title + ' must be hex string or Uint8Array');
          }
          const len = res.length;
          if (typeof expectedLength === 'number' && len !== expectedLength)
              throw new Error(title + ' of length ' + expectedLength + ' expected, got ' + len);
          return res;
      }
      /**
       * @example utf8ToBytes('abc') // new Uint8Array([97, 98, 99])
       */
      // export const utf8ToBytes: typeof utf8ToBytes_ = utf8ToBytes_;
      /**
       * Converts bytes to string using UTF8 encoding.
       * @example bytesToUtf8(Uint8Array.from([97, 98, 99])) // 'abc'
       */
      // export const bytesToUtf8: typeof bytesToUtf8_ = bytesToUtf8_;
      // Is positive bigint
      const isPosBig = (n) => typeof n === 'bigint' && _0n$3 <= n;
      function inRange(n, min, max) {
          return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
      }
      /**
       * Asserts min <= n < max. NOTE: It's < max and not <= max.
       * @example
       * aInRange('x', x, 1n, 256n); // would assume x is in (1n..255n)
       */
      function aInRange(title, n, min, max) {
          // Why min <= n < max and not a (min < n < max) OR b (min <= n <= max)?
          // consider P=256n, min=0n, max=P
          // - a for min=0 would require -1:          `inRange('x', x, -1n, P)`
          // - b would commonly require subtraction:  `inRange('x', x, 0n, P - 1n)`
          // - our way is the cleanest:               `inRange('x', x, 0n, P)
          if (!inRange(n, min, max))
              throw new Error('expected valid ' + title + ': ' + min + ' <= n < ' + max + ', got ' + n);
      }
      // Bit operations
      /**
       * Calculates amount of bits in a bigint.
       * Same as `n.toString(2).length`
       * TODO: merge with nLength in modular
       */
      function bitLen(n) {
          let len;
          for (len = 0; n > _0n$3; n >>= _1n$4, len += 1)
              ;
          return len;
      }
      /**
       * Calculate mask for N bits. Not using ** operator with bigints because of old engines.
       * Same as BigInt(`0b${Array(i).fill('1').join('')}`)
       */
      const bitMask = (n) => (_1n$4 << BigInt(n)) - _1n$4;
      function _validateObject(object, fields, optFields = {}) {
          if (!object || typeof object !== 'object')
              throw new Error('expected valid options object');
          function checkField(fieldName, expectedType, isOpt) {
              const val = object[fieldName];
              if (isOpt && val === undefined)
                  return;
              const current = typeof val;
              if (current !== expectedType || val === null)
                  throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
          }
          Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
          Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
      }
      /**
       * Memoizes (caches) computation result.
       * Uses WeakMap: the value is going auto-cleaned by GC after last reference is removed.
       */
      function memoized(fn) {
          const map = new WeakMap();
          return (arg, ...args) => {
              const val = map.get(arg);
              if (val !== undefined)
                  return val;
              const computed = fn(arg, ...args);
              map.set(arg, computed);
              return computed;
          };
      }

      /**
       * Utils for modular division and fields.
       * Field over 11 is a finite (Galois) field is integer number operations `mod 11`.
       * There is no division: it is replaced by modular multiplicative inverse.
       * @module
       */
      /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
      // prettier-ignore
      const _0n$2 = BigInt(0), _1n$3 = BigInt(1), _2n$2 = /* @__PURE__ */ BigInt(2), _3n = /* @__PURE__ */ BigInt(3);
      // prettier-ignore
      const _4n = /* @__PURE__ */ BigInt(4), _5n$1 = /* @__PURE__ */ BigInt(5), _7n = /* @__PURE__ */ BigInt(7);
      // prettier-ignore
      const _8n$2 = /* @__PURE__ */ BigInt(8), _9n = /* @__PURE__ */ BigInt(9), _16n = /* @__PURE__ */ BigInt(16);
      // Calculates a modulo b
      function mod(a, b) {
          const result = a % b;
          return result >= _0n$2 ? result : b + result;
      }
      /** Does `x^(2^power)` mod p. `pow2(30, 4)` == `30^(2^4)` */
      function pow2(x, power, modulo) {
          let res = x;
          while (power-- > _0n$2) {
              res *= res;
              res %= modulo;
          }
          return res;
      }
      /**
       * Inverses number over modulo.
       * Implemented using [Euclidean GCD](https://brilliant.org/wiki/extended-euclidean-algorithm/).
       */
      function invert(number, modulo) {
          if (number === _0n$2)
              throw new Error('invert: expected non-zero number');
          if (modulo <= _0n$2)
              throw new Error('invert: expected positive modulus, got ' + modulo);
          // Fermat's little theorem "CT-like" version inv(n) = n^(m-2) mod m is 30x slower.
          let a = mod(number, modulo);
          let b = modulo;
          // prettier-ignore
          let x = _0n$2, u = _1n$3;
          while (a !== _0n$2) {
              // JIT applies optimization if those two lines follow each other
              const q = b / a;
              const r = b % a;
              const m = x - u * q;
              // prettier-ignore
              b = a, a = r, x = u, u = m;
          }
          const gcd = b;
          if (gcd !== _1n$3)
              throw new Error('invert: does not exist');
          return mod(x, modulo);
      }
      function assertIsSquare(Fp, root, n) {
          if (!Fp.eql(Fp.sqr(root), n))
              throw new Error('Cannot find square root');
      }
      // Not all roots are possible! Example which will throw:
      // const NUM =
      // n = 72057594037927816n;
      // Fp = Field(BigInt('0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab'));
      function sqrt3mod4(Fp, n) {
          const p1div4 = (Fp.ORDER + _1n$3) / _4n;
          const root = Fp.pow(n, p1div4);
          assertIsSquare(Fp, root, n);
          return root;
      }
      function sqrt5mod8(Fp, n) {
          const p5div8 = (Fp.ORDER - _5n$1) / _8n$2;
          const n2 = Fp.mul(n, _2n$2);
          const v = Fp.pow(n2, p5div8);
          const nv = Fp.mul(n, v);
          const i = Fp.mul(Fp.mul(nv, _2n$2), v);
          const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
          assertIsSquare(Fp, root, n);
          return root;
      }
      // Based on RFC9380, Kong algorithm
      // prettier-ignore
      function sqrt9mod16(P) {
          const Fp_ = Field(P);
          const tn = tonelliShanks(P);
          const c1 = tn(Fp_, Fp_.neg(Fp_.ONE)); //  1. c1 = sqrt(-1) in F, i.e., (c1^2) == -1 in F
          const c2 = tn(Fp_, c1); //  2. c2 = sqrt(c1) in F, i.e., (c2^2) == c1 in F
          const c3 = tn(Fp_, Fp_.neg(c1)); //  3. c3 = sqrt(-c1) in F, i.e., (c3^2) == -c1 in F
          const c4 = (P + _7n) / _16n; //  4. c4 = (q + 7) / 16        # Integer arithmetic
          return (Fp, n) => {
              let tv1 = Fp.pow(n, c4); //  1. tv1 = x^c4
              let tv2 = Fp.mul(tv1, c1); //  2. tv2 = c1 * tv1
              const tv3 = Fp.mul(tv1, c2); //  3. tv3 = c2 * tv1
              const tv4 = Fp.mul(tv1, c3); //  4. tv4 = c3 * tv1
              const e1 = Fp.eql(Fp.sqr(tv2), n); //  5.  e1 = (tv2^2) == x
              const e2 = Fp.eql(Fp.sqr(tv3), n); //  6.  e2 = (tv3^2) == x
              tv1 = Fp.cmov(tv1, tv2, e1); //  7. tv1 = CMOV(tv1, tv2, e1)  # Select tv2 if (tv2^2) == x
              tv2 = Fp.cmov(tv4, tv3, e2); //  8. tv2 = CMOV(tv4, tv3, e2)  # Select tv3 if (tv3^2) == x
              const e3 = Fp.eql(Fp.sqr(tv2), n); //  9.  e3 = (tv2^2) == x
              const root = Fp.cmov(tv1, tv2, e3); // 10.  z = CMOV(tv1, tv2, e3)   # Select sqrt from tv1 & tv2
              assertIsSquare(Fp, root, n);
              return root;
          };
      }
      /**
       * Tonelli-Shanks square root search algorithm.
       * 1. https://eprint.iacr.org/2012/685.pdf (page 12)
       * 2. Square Roots from 1; 24, 51, 10 to Dan Shanks
       * @param P field order
       * @returns function that takes field Fp (created from P) and number n
       */
      function tonelliShanks(P) {
          // Initialization (precomputation).
          // Caching initialization could boost perf by 7%.
          if (P < _3n)
              throw new Error('sqrt is not defined for small field');
          // Factor P - 1 = Q * 2^S, where Q is odd
          let Q = P - _1n$3;
          let S = 0;
          while (Q % _2n$2 === _0n$2) {
              Q /= _2n$2;
              S++;
          }
          // Find the first quadratic non-residue Z >= 2
          let Z = _2n$2;
          const _Fp = Field(P);
          while (FpLegendre(_Fp, Z) === 1) {
              // Basic primality test for P. After x iterations, chance of
              // not finding quadratic non-residue is 2^x, so 2^1000.
              if (Z++ > 1000)
                  throw new Error('Cannot find square root: probably non-prime P');
          }
          // Fast-path; usually done before Z, but we do "primality test".
          if (S === 1)
              return sqrt3mod4;
          // Slow-path
          // TODO: test on Fp2 and others
          let cc = _Fp.pow(Z, Q); // c = z^Q
          const Q1div2 = (Q + _1n$3) / _2n$2;
          return function tonelliSlow(Fp, n) {
              if (Fp.is0(n))
                  return n;
              // Check if n is a quadratic residue using Legendre symbol
              if (FpLegendre(Fp, n) !== 1)
                  throw new Error('Cannot find square root');
              // Initialize variables for the main loop
              let M = S;
              let c = Fp.mul(Fp.ONE, cc); // c = z^Q, move cc from field _Fp into field Fp
              let t = Fp.pow(n, Q); // t = n^Q, first guess at the fudge factor
              let R = Fp.pow(n, Q1div2); // R = n^((Q+1)/2), first guess at the square root
              // Main loop
              // while t != 1
              while (!Fp.eql(t, Fp.ONE)) {
                  if (Fp.is0(t))
                      return Fp.ZERO; // if t=0 return R=0
                  let i = 1;
                  // Find the smallest i >= 1 such that t^(2^i) ≡ 1 (mod P)
                  let t_tmp = Fp.sqr(t); // t^(2^1)
                  while (!Fp.eql(t_tmp, Fp.ONE)) {
                      i++;
                      t_tmp = Fp.sqr(t_tmp); // t^(2^2)...
                      if (i === M)
                          throw new Error('Cannot find square root');
                  }
                  // Calculate the exponent for b: 2^(M - i - 1)
                  const exponent = _1n$3 << BigInt(M - i - 1); // bigint is important
                  const b = Fp.pow(c, exponent); // b = 2^(M - i - 1)
                  // Update variables
                  M = i;
                  c = Fp.sqr(b); // c = b^2
                  t = Fp.mul(t, c); // t = (t * b^2)
                  R = Fp.mul(R, b); // R = R*b
              }
              return R;
          };
      }
      /**
       * Square root for a finite field. Will try optimized versions first:
       *
       * 1. P ≡ 3 (mod 4)
       * 2. P ≡ 5 (mod 8)
       * 3. P ≡ 9 (mod 16)
       * 4. Tonelli-Shanks algorithm
       *
       * Different algorithms can give different roots, it is up to user to decide which one they want.
       * For example there is FpSqrtOdd/FpSqrtEven to choice root based on oddness (used for hash-to-curve).
       */
      function FpSqrt(P) {
          // P ≡ 3 (mod 4) => √n = n^((P+1)/4)
          if (P % _4n === _3n)
              return sqrt3mod4;
          // P ≡ 5 (mod 8) => Atkin algorithm, page 10 of https://eprint.iacr.org/2012/685.pdf
          if (P % _8n$2 === _5n$1)
              return sqrt5mod8;
          // P ≡ 9 (mod 16) => Kong algorithm, page 11 of https://eprint.iacr.org/2012/685.pdf (algorithm 4)
          if (P % _16n === _9n)
              return sqrt9mod16(P);
          // Tonelli-Shanks algorithm
          return tonelliShanks(P);
      }
      // Little-endian check for first LE bit (last BE bit);
      const isNegativeLE = (num, modulo) => (mod(num, modulo) & _1n$3) === _1n$3;
      // prettier-ignore
      const FIELD_FIELDS = [
          'create', 'isValid', 'is0', 'neg', 'inv', 'sqrt', 'sqr',
          'eql', 'add', 'sub', 'mul', 'pow', 'div',
          'addN', 'subN', 'mulN', 'sqrN'
      ];
      function validateField(field) {
          const initial = {
              ORDER: 'bigint',
              MASK: 'bigint',
              BYTES: 'number',
              BITS: 'number',
          };
          const opts = FIELD_FIELDS.reduce((map, val) => {
              map[val] = 'function';
              return map;
          }, initial);
          _validateObject(field, opts);
          // const max = 16384;
          // if (field.BYTES < 1 || field.BYTES > max) throw new Error('invalid field');
          // if (field.BITS < 1 || field.BITS > 8 * max) throw new Error('invalid field');
          return field;
      }
      // Generic field functions
      /**
       * Same as `pow` but for Fp: non-constant-time.
       * Unsafe in some contexts: uses ladder, so can expose bigint bits.
       */
      function FpPow(Fp, num, power) {
          if (power < _0n$2)
              throw new Error('invalid exponent, negatives unsupported');
          if (power === _0n$2)
              return Fp.ONE;
          if (power === _1n$3)
              return num;
          let p = Fp.ONE;
          let d = num;
          while (power > _0n$2) {
              if (power & _1n$3)
                  p = Fp.mul(p, d);
              d = Fp.sqr(d);
              power >>= _1n$3;
          }
          return p;
      }
      /**
       * Efficiently invert an array of Field elements.
       * Exception-free. Will return `undefined` for 0 elements.
       * @param passZero map 0 to 0 (instead of undefined)
       */
      function FpInvertBatch(Fp, nums, passZero = false) {
          const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : undefined);
          // Walk from first to last, multiply them by each other MOD p
          const multipliedAcc = nums.reduce((acc, num, i) => {
              if (Fp.is0(num))
                  return acc;
              inverted[i] = acc;
              return Fp.mul(acc, num);
          }, Fp.ONE);
          // Invert last element
          const invertedAcc = Fp.inv(multipliedAcc);
          // Walk from last to first, multiply them by inverted each other MOD p
          nums.reduceRight((acc, num, i) => {
              if (Fp.is0(num))
                  return acc;
              inverted[i] = Fp.mul(acc, inverted[i]);
              return Fp.mul(acc, num);
          }, invertedAcc);
          return inverted;
      }
      /**
       * Legendre symbol.
       * Legendre constant is used to calculate Legendre symbol (a | p)
       * which denotes the value of a^((p-1)/2) (mod p).
       *
       * * (a | p) ≡ 1    if a is a square (mod p), quadratic residue
       * * (a | p) ≡ -1   if a is not a square (mod p), quadratic non residue
       * * (a | p) ≡ 0    if a ≡ 0 (mod p)
       */
      function FpLegendre(Fp, n) {
          // We can use 3rd argument as optional cache of this value
          // but seems unneeded for now. The operation is very fast.
          const p1mod2 = (Fp.ORDER - _1n$3) / _2n$2;
          const powered = Fp.pow(n, p1mod2);
          const yes = Fp.eql(powered, Fp.ONE);
          const zero = Fp.eql(powered, Fp.ZERO);
          const no = Fp.eql(powered, Fp.neg(Fp.ONE));
          if (!yes && !zero && !no)
              throw new Error('invalid Legendre symbol result');
          return yes ? 1 : zero ? 0 : -1;
      }
      // CURVE.n lengths
      function nLength(n, nBitLength) {
          // Bit size, byte size of CURVE.n
          if (nBitLength !== undefined)
              anumber(nBitLength);
          const _nBitLength = nBitLength !== undefined ? nBitLength : n.toString(2).length;
          const nByteLength = Math.ceil(_nBitLength / 8);
          return { nBitLength: _nBitLength, nByteLength };
      }
      /**
       * Creates a finite field. Major performance optimizations:
       * * 1. Denormalized operations like mulN instead of mul.
       * * 2. Identical object shape: never add or remove keys.
       * * 3. `Object.freeze`.
       * Fragile: always run a benchmark on a change.
       * Security note: operations don't check 'isValid' for all elements for performance reasons,
       * it is caller responsibility to check this.
       * This is low-level code, please make sure you know what you're doing.
       *
       * Note about field properties:
       * * CHARACTERISTIC p = prime number, number of elements in main subgroup.
       * * ORDER q = similar to cofactor in curves, may be composite `q = p^m`.
       *
       * @param ORDER field order, probably prime, or could be composite
       * @param bitLen how many bits the field consumes
       * @param isLE (default: false) if encoding / decoding should be in little-endian
       * @param redef optional faster redefinitions of sqrt and other methods
       */
      function Field(ORDER, bitLenOrOpts, // TODO: use opts only in v2?
      isLE = false, opts = {}) {
          if (ORDER <= _0n$2)
              throw new Error('invalid field: expected ORDER > 0, got ' + ORDER);
          let _nbitLength = undefined;
          let _sqrt = undefined;
          let modOnDecode = false;
          let allowedLengths = undefined;
          if (typeof bitLenOrOpts === 'object' && bitLenOrOpts != null) {
              if (opts.sqrt || isLE)
                  throw new Error('cannot specify opts in two arguments');
              const _opts = bitLenOrOpts;
              if (_opts.BITS)
                  _nbitLength = _opts.BITS;
              if (_opts.sqrt)
                  _sqrt = _opts.sqrt;
              if (typeof _opts.isLE === 'boolean')
                  isLE = _opts.isLE;
              if (typeof _opts.modOnDecode === 'boolean')
                  modOnDecode = _opts.modOnDecode;
              allowedLengths = _opts.allowedLengths;
          }
          else {
              if (typeof bitLenOrOpts === 'number')
                  _nbitLength = bitLenOrOpts;
              if (opts.sqrt)
                  _sqrt = opts.sqrt;
          }
          const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
          if (BYTES > 2048)
              throw new Error('invalid field: expected ORDER of <= 2048 bytes');
          let sqrtP; // cached sqrtP
          const f = Object.freeze({
              ORDER,
              isLE,
              BITS,
              BYTES,
              MASK: bitMask(BITS),
              ZERO: _0n$2,
              ONE: _1n$3,
              allowedLengths: allowedLengths,
              create: (num) => mod(num, ORDER),
              isValid: (num) => {
                  if (typeof num !== 'bigint')
                      throw new Error('invalid field element: expected bigint, got ' + typeof num);
                  return _0n$2 <= num && num < ORDER; // 0 is valid element, but it's not invertible
              },
              is0: (num) => num === _0n$2,
              // is valid and invertible
              isValidNot0: (num) => !f.is0(num) && f.isValid(num),
              isOdd: (num) => (num & _1n$3) === _1n$3,
              neg: (num) => mod(-num, ORDER),
              eql: (lhs, rhs) => lhs === rhs,
              sqr: (num) => mod(num * num, ORDER),
              add: (lhs, rhs) => mod(lhs + rhs, ORDER),
              sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
              mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
              pow: (num, power) => FpPow(f, num, power),
              div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
              // Same as above, but doesn't normalize
              sqrN: (num) => num * num,
              addN: (lhs, rhs) => lhs + rhs,
              subN: (lhs, rhs) => lhs - rhs,
              mulN: (lhs, rhs) => lhs * rhs,
              inv: (num) => invert(num, ORDER),
              sqrt: _sqrt ||
                  ((n) => {
                      if (!sqrtP)
                          sqrtP = FpSqrt(ORDER);
                      return sqrtP(f, n);
                  }),
              toBytes: (num) => (isLE ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES)),
              fromBytes: (bytes, skipValidation = true) => {
                  if (allowedLengths) {
                      if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
                          throw new Error('Field.fromBytes: expected ' + allowedLengths + ' bytes, got ' + bytes.length);
                      }
                      const padded = new Uint8Array(BYTES);
                      // isLE add 0 to right, !isLE to the left.
                      padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
                      bytes = padded;
                  }
                  if (bytes.length !== BYTES)
                      throw new Error('Field.fromBytes: expected ' + BYTES + ' bytes, got ' + bytes.length);
                  let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
                  if (modOnDecode)
                      scalar = mod(scalar, ORDER);
                  if (!skipValidation)
                      if (!f.isValid(scalar))
                          throw new Error('invalid field element: outside of range 0..ORDER');
                  // NOTE: we don't validate scalar here, please use isValid. This done such way because some
                  // protocol may allow non-reduced scalar that reduced later or changed some other way.
                  return scalar;
              },
              // TODO: we don't need it here, move out to separate fn
              invertBatch: (lst) => FpInvertBatch(f, lst),
              // We can't move this out because Fp6, Fp12 implement it
              // and it's unclear what to return in there.
              cmov: (a, b, c) => (c ? b : a),
          });
          return Object.freeze(f);
      }

      /**
       * Methods for elliptic curve multiplication by scalars.
       * Contains wNAF, pippenger.
       * @module
       */
      /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
      const _0n$1 = BigInt(0);
      const _1n$2 = BigInt(1);
      function negateCt(condition, item) {
          const neg = item.negate();
          return condition ? neg : item;
      }
      /**
       * Takes a bunch of Projective Points but executes only one
       * inversion on all of them. Inversion is very slow operation,
       * so this improves performance massively.
       * Optimization: converts a list of projective points to a list of identical points with Z=1.
       */
      function normalizeZ(c, points) {
          const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
          return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
      }
      function validateW(W, bits) {
          if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
              throw new Error('invalid window size, expected [1..' + bits + '], got W=' + W);
      }
      function calcWOpts(W, scalarBits) {
          validateW(W, scalarBits);
          const windows = Math.ceil(scalarBits / W) + 1; // W=8 33. Not 32, because we skip zero
          const windowSize = 2 ** (W - 1); // W=8 128. Not 256, because we skip zero
          const maxNumber = 2 ** W; // W=8 256
          const mask = bitMask(W); // W=8 255 == mask 0b11111111
          const shiftBy = BigInt(W); // W=8 8
          return { windows, windowSize, mask, maxNumber, shiftBy };
      }
      function calcOffsets(n, window, wOpts) {
          const { windowSize, mask, maxNumber, shiftBy } = wOpts;
          let wbits = Number(n & mask); // extract W bits.
          let nextN = n >> shiftBy; // shift number by W bits.
          // What actually happens here:
          // const highestBit = Number(mask ^ (mask >> 1n));
          // let wbits2 = wbits - 1; // skip zero
          // if (wbits2 & highestBit) { wbits2 ^= Number(mask); // (~);
          // split if bits > max: +224 => 256-32
          if (wbits > windowSize) {
              // we skip zero, which means instead of `>= size-1`, we do `> size`
              wbits -= maxNumber; // -32, can be maxNumber - wbits, but then we need to set isNeg here.
              nextN += _1n$2; // +256 (carry)
          }
          const offsetStart = window * windowSize;
          const offset = offsetStart + Math.abs(wbits) - 1; // -1 because we skip zero
          const isZero = wbits === 0; // is current window slice a 0?
          const isNeg = wbits < 0; // is current window slice negative?
          const isNegF = window % 2 !== 0; // fake random statement for noise
          const offsetF = offsetStart; // fake offset for noise
          return { nextN, offset, isZero, isNeg, isNegF, offsetF };
      }
      function validateMSMPoints(points, c) {
          if (!Array.isArray(points))
              throw new Error('array expected');
          points.forEach((p, i) => {
              if (!(p instanceof c))
                  throw new Error('invalid point at index ' + i);
          });
      }
      function validateMSMScalars(scalars, field) {
          if (!Array.isArray(scalars))
              throw new Error('array of scalars expected');
          scalars.forEach((s, i) => {
              if (!field.isValid(s))
                  throw new Error('invalid scalar at index ' + i);
          });
      }
      // Since points in different groups cannot be equal (different object constructor),
      // we can have single place to store precomputes.
      // Allows to make points frozen / immutable.
      const pointPrecomputes = new WeakMap();
      const pointWindowSizes = new WeakMap();
      function getW(P) {
          // To disable precomputes:
          // return 1;
          return pointWindowSizes.get(P) || 1;
      }
      function assert0(n) {
          if (n !== _0n$1)
              throw new Error('invalid wNAF');
      }
      /**
       * Elliptic curve multiplication of Point by scalar. Fragile.
       * Table generation takes **30MB of ram and 10ms on high-end CPU**,
       * but may take much longer on slow devices. Actual generation will happen on
       * first call of `multiply()`. By default, `BASE` point is precomputed.
       *
       * Scalars should always be less than curve order: this should be checked inside of a curve itself.
       * Creates precomputation tables for fast multiplication:
       * - private scalar is split by fixed size windows of W bits
       * - every window point is collected from window's table & added to accumulator
       * - since windows are different, same point inside tables won't be accessed more than once per calc
       * - each multiplication is 'Math.ceil(CURVE_ORDER / 𝑊) + 1' point additions (fixed for any scalar)
       * - +1 window is neccessary for wNAF
       * - wNAF reduces table size: 2x less memory + 2x faster generation, but 10% slower multiplication
       *
       * @todo Research returning 2d JS array of windows, instead of a single window.
       * This would allow windows to be in different memory locations
       */
      class wNAF {
          // Parametrized with a given Point class (not individual point)
          constructor(Point, bits) {
              this.BASE = Point.BASE;
              this.ZERO = Point.ZERO;
              this.Fn = Point.Fn;
              this.bits = bits;
          }
          // non-const time multiplication ladder
          _unsafeLadder(elm, n, p = this.ZERO) {
              let d = elm;
              while (n > _0n$1) {
                  if (n & _1n$2)
                      p = p.add(d);
                  d = d.double();
                  n >>= _1n$2;
              }
              return p;
          }
          /**
           * Creates a wNAF precomputation window. Used for caching.
           * Default window size is set by `utils.precompute()` and is equal to 8.
           * Number of precomputed points depends on the curve size:
           * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
           * - 𝑊 is the window size
           * - 𝑛 is the bitlength of the curve order.
           * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
           * @param point Point instance
           * @param W window size
           * @returns precomputed point tables flattened to a single array
           */
          precomputeWindow(point, W) {
              const { windows, windowSize } = calcWOpts(W, this.bits);
              const points = [];
              let p = point;
              let base = p;
              for (let window = 0; window < windows; window++) {
                  base = p;
                  points.push(base);
                  // i=1, bc we skip 0
                  for (let i = 1; i < windowSize; i++) {
                      base = base.add(p);
                      points.push(base);
                  }
                  p = base.double();
              }
              return points;
          }
          /**
           * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
           * More compact implementation:
           * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
           * @returns real and fake (for const-time) points
           */
          wNAF(W, precomputes, n) {
              // Scalar should be smaller than field order
              if (!this.Fn.isValid(n))
                  throw new Error('invalid scalar');
              // Accumulators
              let p = this.ZERO;
              let f = this.BASE;
              // This code was first written with assumption that 'f' and 'p' will never be infinity point:
              // since each addition is multiplied by 2 ** W, it cannot cancel each other. However,
              // there is negate now: it is possible that negated element from low value
              // would be the same as high element, which will create carry into next window.
              // It's not obvious how this can fail, but still worth investigating later.
              const wo = calcWOpts(W, this.bits);
              for (let window = 0; window < wo.windows; window++) {
                  // (n === _0n) is handled and not early-exited. isEven and offsetF are used for noise
                  const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
                  n = nextN;
                  if (isZero) {
                      // bits are 0: add garbage to fake point
                      // Important part for const-time getPublicKey: add random "noise" point to f.
                      f = f.add(negateCt(isNegF, precomputes[offsetF]));
                  }
                  else {
                      // bits are 1: add to result point
                      p = p.add(negateCt(isNeg, precomputes[offset]));
                  }
              }
              assert0(n);
              // Return both real and fake points: JIT won't eliminate f.
              // At this point there is a way to F be infinity-point even if p is not,
              // which makes it less const-time: around 1 bigint multiply.
              return { p, f };
          }
          /**
           * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
           * @param acc accumulator point to add result of multiplication
           * @returns point
           */
          wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
              const wo = calcWOpts(W, this.bits);
              for (let window = 0; window < wo.windows; window++) {
                  if (n === _0n$1)
                      break; // Early-exit, skip 0 value
                  const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
                  n = nextN;
                  if (isZero) {
                      // Window bits are 0: skip processing.
                      // Move to next window.
                      continue;
                  }
                  else {
                      const item = precomputes[offset];
                      acc = acc.add(isNeg ? item.negate() : item); // Re-using acc allows to save adds in MSM
                  }
              }
              assert0(n);
              return acc;
          }
          getPrecomputes(W, point, transform) {
              // Calculate precomputes on a first run, reuse them after
              let comp = pointPrecomputes.get(point);
              if (!comp) {
                  comp = this.precomputeWindow(point, W);
                  if (W !== 1) {
                      // Doing transform outside of if brings 15% perf hit
                      if (typeof transform === 'function')
                          comp = transform(comp);
                      pointPrecomputes.set(point, comp);
                  }
              }
              return comp;
          }
          cached(point, scalar, transform) {
              const W = getW(point);
              return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
          }
          unsafe(point, scalar, transform, prev) {
              const W = getW(point);
              if (W === 1)
                  return this._unsafeLadder(point, scalar, prev); // For W=1 ladder is ~x2 faster
              return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
          }
          // We calculate precomputes for elliptic curve point multiplication
          // using windowed method. This specifies window size and
          // stores precomputed values. Usually only base point would be precomputed.
          createCache(P, W) {
              validateW(W, this.bits);
              pointWindowSizes.set(P, W);
              pointPrecomputes.delete(P);
          }
          hasCache(elm) {
              return getW(elm) !== 1;
          }
      }
      /**
       * Pippenger algorithm for multi-scalar multiplication (MSM, Pa + Qb + Rc + ...).
       * 30x faster vs naive addition on L=4096, 10x faster than precomputes.
       * For N=254bit, L=1, it does: 1024 ADD + 254 DBL. For L=5: 1536 ADD + 254 DBL.
       * Algorithmically constant-time (for same L), even when 1 point + scalar, or when scalar = 0.
       * @param c Curve Point constructor
       * @param fieldN field over CURVE.N - important that it's not over CURVE.P
       * @param points array of L curve points
       * @param scalars array of L scalars (aka secret keys / bigints)
       */
      function pippenger(c, fieldN, points, scalars) {
          // If we split scalars by some window (let's say 8 bits), every chunk will only
          // take 256 buckets even if there are 4096 scalars, also re-uses double.
          // TODO:
          // - https://eprint.iacr.org/2024/750.pdf
          // - https://tches.iacr.org/index.php/TCHES/article/view/10287
          // 0 is accepted in scalars
          validateMSMPoints(points, c);
          validateMSMScalars(scalars, fieldN);
          const plength = points.length;
          const slength = scalars.length;
          if (plength !== slength)
              throw new Error('arrays of points and scalars must have equal length');
          // if (plength === 0) throw new Error('array must be of length >= 2');
          const zero = c.ZERO;
          const wbits = bitLen(BigInt(plength));
          let windowSize = 1; // bits
          if (wbits > 12)
              windowSize = wbits - 3;
          else if (wbits > 4)
              windowSize = wbits - 2;
          else if (wbits > 0)
              windowSize = 2;
          const MASK = bitMask(windowSize);
          const buckets = new Array(Number(MASK) + 1).fill(zero); // +1 for zero array
          const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
          let sum = zero;
          for (let i = lastBits; i >= 0; i -= windowSize) {
              buckets.fill(zero);
              for (let j = 0; j < slength; j++) {
                  const scalar = scalars[j];
                  const wbits = Number((scalar >> BigInt(i)) & MASK);
                  buckets[wbits] = buckets[wbits].add(points[j]);
              }
              let resI = zero; // not using this will do small speed-up, but will lose ct
              // Skip first bucket, because it is zero
              for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
                  sumI = sumI.add(buckets[j]);
                  resI = resI.add(sumI);
              }
              sum = sum.add(resI);
              if (i !== 0)
                  for (let j = 0; j < windowSize; j++)
                      sum = sum.double();
          }
          return sum;
      }
      function createField(order, field) {
          if (field) {
              if (field.ORDER !== order)
                  throw new Error('Field.ORDER must match order: Fp == p, Fn == n');
              validateField(field);
              return field;
          }
          else {
              return Field(order);
          }
      }
      /** Validates CURVE opts and creates fields */
      function _createCurveFields(type, CURVE, curveOpts = {}) {
          if (!CURVE || typeof CURVE !== 'object')
              throw new Error(`expected valid ${type} CURVE object`);
          for (const p of ['p', 'n', 'h']) {
              const val = CURVE[p];
              if (!(typeof val === 'bigint' && val > _0n$1))
                  throw new Error(`CURVE.${p} must be positive bigint`);
          }
          const Fp = createField(CURVE.p, curveOpts.Fp);
          const Fn = createField(CURVE.n, curveOpts.Fn);
          const _b = 'd';
          const params = ['Gx', 'Gy', 'a', _b];
          for (const p of params) {
              // @ts-ignore
              if (!Fp.isValid(CURVE[p]))
                  throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
          }
          return { Fp, Fn };
      }

      /**
       * Twisted Edwards curve. The formula is: ax² + y² = 1 + dx²y².
       * For design rationale of types / exports, see weierstrass module documentation.
       * Untwisted Edwards curves exist, but they aren't used in real-world protocols.
       * @module
       */
      /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
      // Be friendly to bad ECMAScript parsers by not using bigint literals
      // prettier-ignore
      const _0n = BigInt(0), _1n$1 = BigInt(1), _2n$1 = BigInt(2), _8n$1 = BigInt(8);
      function isEdValidXY(Fp, CURVE, x, y) {
          const x2 = Fp.sqr(x);
          const y2 = Fp.sqr(y);
          const left = Fp.add(Fp.mul(CURVE.a, x2), y2);
          const right = Fp.add(Fp.ONE, Fp.mul(CURVE.d, Fp.mul(x2, y2)));
          return Fp.eql(left, right);
      }
      function edwards(CURVE, curveOpts = {}) {
          const { Fp, Fn } = _createCurveFields('edwards', CURVE, curveOpts);
          const { h: cofactor, n: CURVE_ORDER } = CURVE;
          _validateObject(curveOpts, {}, { uvRatio: 'function' });
          // Important:
          // There are some places where Fp.BYTES is used instead of nByteLength.
          // So far, everything has been tested with curves of Fp.BYTES == nByteLength.
          // TODO: test and find curves which behave otherwise.
          const MASK = _2n$1 << (BigInt(Fn.BYTES * 8) - _1n$1);
          const modP = (n) => Fp.create(n); // Function overrides
          // sqrt(u/v)
          const uvRatio = curveOpts.uvRatio ||
              ((u, v) => {
                  try {
                      return { isValid: true, value: Fp.sqrt(Fp.div(u, v)) };
                  }
                  catch (e) {
                      return { isValid: false, value: _0n };
                  }
              });
          // Validate whether the passed curve params are valid.
          // equation ax² + y² = 1 + dx²y² should work for generator point.
          if (!isEdValidXY(Fp, CURVE, CURVE.Gx, CURVE.Gy))
              throw new Error('bad curve params: generator point');
          /**
           * Asserts coordinate is valid: 0 <= n < MASK.
           * Coordinates >= Fp.ORDER are allowed for zip215.
           */
          function acoord(title, n, banZero = false) {
              const min = banZero ? _1n$1 : _0n;
              aInRange('coordinate ' + title, n, min, MASK);
              return n;
          }
          function aextpoint(other) {
              if (!(other instanceof Point))
                  throw new Error('ExtendedPoint expected');
          }
          // Converts Extended point to default (x, y) coordinates.
          // Can accept precomputed Z^-1 - for example, from invertBatch.
          const toAffineMemo = memoized((p, iz) => {
              const { X, Y, Z } = p;
              const is0 = p.is0();
              if (iz == null)
                  iz = is0 ? _8n$1 : Fp.inv(Z); // 8 was chosen arbitrarily
              const x = modP(X * iz);
              const y = modP(Y * iz);
              const zz = Fp.mul(Z, iz);
              if (is0)
                  return { x: _0n, y: _1n$1 };
              if (zz !== _1n$1)
                  throw new Error('invZ was invalid');
              return { x, y };
          });
          const assertValidMemo = memoized((p) => {
              const { a, d } = CURVE;
              if (p.is0())
                  throw new Error('bad point: ZERO'); // TODO: optimize, with vars below?
              // Equation in affine coordinates: ax² + y² = 1 + dx²y²
              // Equation in projective coordinates (X/Z, Y/Z, Z):  (aX² + Y²)Z² = Z⁴ + dX²Y²
              const { X, Y, Z, T } = p;
              const X2 = modP(X * X); // X²
              const Y2 = modP(Y * Y); // Y²
              const Z2 = modP(Z * Z); // Z²
              const Z4 = modP(Z2 * Z2); // Z⁴
              const aX2 = modP(X2 * a); // aX²
              const left = modP(Z2 * modP(aX2 + Y2)); // (aX² + Y²)Z²
              const right = modP(Z4 + modP(d * modP(X2 * Y2))); // Z⁴ + dX²Y²
              if (left !== right)
                  throw new Error('bad point: equation left != right (1)');
              // In Extended coordinates we also have T, which is x*y=T/Z: check X*Y == Z*T
              const XY = modP(X * Y);
              const ZT = modP(Z * T);
              if (XY !== ZT)
                  throw new Error('bad point: equation left != right (2)');
              return true;
          });
          // Extended Point works in extended coordinates: (X, Y, Z, T) ∋ (x=X/Z, y=Y/Z, T=xy).
          // https://en.wikipedia.org/wiki/Twisted_Edwards_curve#Extended_coordinates
          class Point {
              constructor(X, Y, Z, T) {
                  this.X = acoord('x', X);
                  this.Y = acoord('y', Y);
                  this.Z = acoord('z', Z, true);
                  this.T = acoord('t', T);
                  Object.freeze(this);
              }
              get x() {
                  return this.toAffine().x;
              }
              get y() {
                  return this.toAffine().y;
              }
              // TODO: remove
              get ex() {
                  return this.X;
              }
              get ey() {
                  return this.Y;
              }
              get ez() {
                  return this.Z;
              }
              get et() {
                  return this.T;
              }
              static normalizeZ(points) {
                  return normalizeZ(Point, points);
              }
              static msm(points, scalars) {
                  return pippenger(Point, Fn, points, scalars);
              }
              _setWindowSize(windowSize) {
                  this.precompute(windowSize);
              }
              static fromAffine(p) {
                  if (p instanceof Point)
                      throw new Error('extended point not allowed');
                  const { x, y } = p || {};
                  acoord('x', x);
                  acoord('y', y);
                  return new Point(x, y, _1n$1, modP(x * y));
              }
              precompute(windowSize = 8, isLazy = true) {
                  wnaf.createCache(this, windowSize);
                  if (!isLazy)
                      this.multiply(_2n$1); // random number
                  return this;
              }
              // Useful in fromAffine() - not for fromBytes(), which always created valid points.
              assertValidity() {
                  assertValidMemo(this);
              }
              // Compare one point to another.
              equals(other) {
                  aextpoint(other);
                  const { X: X1, Y: Y1, Z: Z1 } = this;
                  const { X: X2, Y: Y2, Z: Z2 } = other;
                  const X1Z2 = modP(X1 * Z2);
                  const X2Z1 = modP(X2 * Z1);
                  const Y1Z2 = modP(Y1 * Z2);
                  const Y2Z1 = modP(Y2 * Z1);
                  return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
              }
              is0() {
                  return this.equals(Point.ZERO);
              }
              negate() {
                  // Flips point sign to a negative one (-x, y in affine coords)
                  return new Point(modP(-this.X), this.Y, this.Z, modP(-this.T));
              }
              // Fast algo for doubling Extended Point.
              // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
              // Cost: 4M + 4S + 1*a + 6add + 1*2.
              double() {
                  const { a } = CURVE;
                  const { X: X1, Y: Y1, Z: Z1 } = this;
                  const A = modP(X1 * X1); // A = X12
                  const B = modP(Y1 * Y1); // B = Y12
                  const C = modP(_2n$1 * modP(Z1 * Z1)); // C = 2*Z12
                  const D = modP(a * A); // D = a*A
                  const x1y1 = X1 + Y1;
                  const E = modP(modP(x1y1 * x1y1) - A - B); // E = (X1+Y1)2-A-B
                  const G = D + B; // G = D+B
                  const F = G - C; // F = G-C
                  const H = D - B; // H = D-B
                  const X3 = modP(E * F); // X3 = E*F
                  const Y3 = modP(G * H); // Y3 = G*H
                  const T3 = modP(E * H); // T3 = E*H
                  const Z3 = modP(F * G); // Z3 = F*G
                  return new Point(X3, Y3, Z3, T3);
              }
              // Fast algo for adding 2 Extended Points.
              // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
              // Cost: 9M + 1*a + 1*d + 7add.
              add(other) {
                  aextpoint(other);
                  const { a, d } = CURVE;
                  const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
                  const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
                  const A = modP(X1 * X2); // A = X1*X2
                  const B = modP(Y1 * Y2); // B = Y1*Y2
                  const C = modP(T1 * d * T2); // C = T1*d*T2
                  const D = modP(Z1 * Z2); // D = Z1*Z2
                  const E = modP((X1 + Y1) * (X2 + Y2) - A - B); // E = (X1+Y1)*(X2+Y2)-A-B
                  const F = D - C; // F = D-C
                  const G = D + C; // G = D+C
                  const H = modP(B - a * A); // H = B-a*A
                  const X3 = modP(E * F); // X3 = E*F
                  const Y3 = modP(G * H); // Y3 = G*H
                  const T3 = modP(E * H); // T3 = E*H
                  const Z3 = modP(F * G); // Z3 = F*G
                  return new Point(X3, Y3, Z3, T3);
              }
              subtract(other) {
                  return this.add(other.negate());
              }
              // Constant-time multiplication.
              multiply(scalar) {
                  const n = scalar;
                  aInRange('scalar', n, _1n$1, CURVE_ORDER); // 1 <= scalar < L
                  const { p, f } = wnaf.cached(this, n, (p) => normalizeZ(Point, p));
                  return normalizeZ(Point, [p, f])[0];
              }
              // Non-constant-time multiplication. Uses double-and-add algorithm.
              // It's faster, but should only be used when you don't care about
              // an exposed private key e.g. sig verification.
              // Does NOT allow scalars higher than CURVE.n.
              // Accepts optional accumulator to merge with multiply (important for sparse scalars)
              multiplyUnsafe(scalar, acc = Point.ZERO) {
                  const n = scalar;
                  aInRange('scalar', n, _0n, CURVE_ORDER); // 0 <= scalar < L
                  if (n === _0n)
                      return Point.ZERO;
                  if (this.is0() || n === _1n$1)
                      return this;
                  return wnaf.unsafe(this, n, (p) => normalizeZ(Point, p), acc);
              }
              // Checks if point is of small order.
              // If you add something to small order point, you will have "dirty"
              // point with torsion component.
              // Multiplies point by cofactor and checks if the result is 0.
              isSmallOrder() {
                  return this.multiplyUnsafe(cofactor).is0();
              }
              // Multiplies point by curve order and checks if the result is 0.
              // Returns `false` is the point is dirty.
              isTorsionFree() {
                  return wnaf.unsafe(this, CURVE_ORDER).is0();
              }
              // Converts Extended point to default (x, y) coordinates.
              // Can accept precomputed Z^-1 - for example, from invertBatch.
              toAffine(invertedZ) {
                  return toAffineMemo(this, invertedZ);
              }
              clearCofactor() {
                  if (cofactor === _1n$1)
                      return this;
                  return this.multiplyUnsafe(cofactor);
              }
              static fromBytes(bytes, zip215 = false) {
                  abytes(bytes);
                  return Point.fromHex(bytes, zip215);
              }
              // Converts hash string or Uint8Array to Point.
              // Uses algo from RFC8032 5.1.3.
              static fromHex(hex, zip215 = false) {
                  const { d, a } = CURVE;
                  const len = Fp.BYTES;
                  hex = ensureBytes('pointHex', hex, len); // copy hex to a new array
                  abool('zip215', zip215);
                  const normed = hex.slice(); // copy again, we'll manipulate it
                  const lastByte = hex[len - 1]; // select last byte
                  normed[len - 1] = lastByte & -129; // clear last bit
                  const y = bytesToNumberLE(normed);
                  // zip215=true is good for consensus-critical apps. =false follows RFC8032 / NIST186-5.
                  // RFC8032 prohibits >= p, but ZIP215 doesn't
                  // zip215=true:  0 <= y < MASK (2^256 for ed25519)
                  // zip215=false: 0 <= y < P (2^255-19 for ed25519)
                  const max = zip215 ? MASK : Fp.ORDER;
                  aInRange('pointHex.y', y, _0n, max);
                  // Ed25519: x² = (y²-1)/(dy²+1) mod p. Ed448: x² = (y²-1)/(dy²-1) mod p. Generic case:
                  // ax²+y²=1+dx²y² => y²-1=dx²y²-ax² => y²-1=x²(dy²-a) => x²=(y²-1)/(dy²-a)
                  const y2 = modP(y * y); // denominator is always non-0 mod p.
                  const u = modP(y2 - _1n$1); // u = y² - 1
                  const v = modP(d * y2 - a); // v = d y² + 1.
                  let { isValid, value: x } = uvRatio(u, v); // √(u/v)
                  if (!isValid)
                      throw new Error('Point.fromHex: invalid y coordinate');
                  const isXOdd = (x & _1n$1) === _1n$1; // There are 2 square roots. Use x_0 bit to select proper
                  const isLastByteOdd = (lastByte & 0x80) !== 0; // x_0, last bit
                  if (!zip215 && x === _0n && isLastByteOdd)
                      // if x=0 and x_0 = 1, fail
                      throw new Error('Point.fromHex: x=0 and x_0=1');
                  if (isLastByteOdd !== isXOdd)
                      x = modP(-x); // if x_0 != x mod 2, set x = p-x
                  return Point.fromAffine({ x, y });
              }
              toBytes() {
                  const { x, y } = this.toAffine();
                  const bytes = numberToBytesLE(y, Fp.BYTES); // each y has 2 x values (x, -y)
                  bytes[bytes.length - 1] |= x & _1n$1 ? 0x80 : 0; // when compressing, it's enough to store y
                  return bytes; // and use the last byte to encode sign of x
              }
              /** @deprecated use `toBytes` */
              toRawBytes() {
                  return this.toBytes();
              }
              toHex() {
                  return bytesToHex(this.toBytes());
              }
              toString() {
                  return `<Point ${this.is0() ? 'ZERO' : this.toHex()}>`;
              }
          }
          // base / generator point
          Point.BASE = new Point(CURVE.Gx, CURVE.Gy, _1n$1, modP(CURVE.Gx * CURVE.Gy));
          // zero / infinity / identity point
          Point.ZERO = new Point(_0n, _1n$1, _1n$1, _0n); // 0, 1, 1, 0
          // fields
          Point.Fp = Fp;
          Point.Fn = Fn;
          const wnaf = new wNAF(Point, Fn.BYTES * 8); // Fn.BITS?
          return Point;
      }
      /**
       * Initializes EdDSA signatures over given Edwards curve.
       */
      function eddsa(Point, cHash, eddsaOpts) {
          if (typeof cHash !== 'function')
              throw new Error('"hash" function param is required');
          _validateObject(eddsaOpts, {}, {
              adjustScalarBytes: 'function',
              randomBytes: 'function',
              domain: 'function',
              prehash: 'function',
              mapToCurve: 'function',
          });
          const { prehash } = eddsaOpts;
          const { BASE: G, Fp, Fn } = Point;
          const CURVE_ORDER = Fn.ORDER;
          const randomBytes_ = eddsaOpts.randomBytes || randomBytes;
          const adjustScalarBytes = eddsaOpts.adjustScalarBytes || ((bytes) => bytes); // NOOP
          const domain = eddsaOpts.domain ||
              ((data, ctx, phflag) => {
                  abool('phflag', phflag);
                  if (ctx.length || phflag)
                      throw new Error('Contexts/pre-hash are not supported');
                  return data;
              }); // NOOP
          function modN(a) {
              return Fn.create(a);
          }
          // Little-endian SHA512 with modulo n
          function modN_LE(hash) {
              // Not using Fn.fromBytes: hash can be 2*Fn.BYTES
              return modN(bytesToNumberLE(hash));
          }
          // Get the hashed private scalar per RFC8032 5.1.5
          function getPrivateScalar(key) {
              const len = Fp.BYTES;
              key = ensureBytes('private key', key, len);
              // Hash private key with curve's hash function to produce uniformingly random input
              // Check byte lengths: ensure(64, h(ensure(32, key)))
              const hashed = ensureBytes('hashed private key', cHash(key), 2 * len);
              const head = adjustScalarBytes(hashed.slice(0, len)); // clear first half bits, produce FE
              const prefix = hashed.slice(len, 2 * len); // second half is called key prefix (5.1.6)
              const scalar = modN_LE(head); // The actual private scalar
              return { head, prefix, scalar };
          }
          /** Convenience method that creates public key from scalar. RFC8032 5.1.5 */
          function getExtendedPublicKey(secretKey) {
              const { head, prefix, scalar } = getPrivateScalar(secretKey);
              const point = G.multiply(scalar); // Point on Edwards curve aka public key
              const pointBytes = point.toBytes();
              return { head, prefix, scalar, point, pointBytes };
          }
          /** Calculates EdDSA pub key. RFC8032 5.1.5. */
          function getPublicKey(secretKey) {
              return getExtendedPublicKey(secretKey).pointBytes;
          }
          // int('LE', SHA512(dom2(F, C) || msgs)) mod N
          function hashDomainToScalar(context = Uint8Array.of(), ...msgs) {
              const msg = concatBytes$1(...msgs);
              return modN_LE(cHash(domain(msg, ensureBytes('context', context), !!prehash)));
          }
          /** Signs message with privateKey. RFC8032 5.1.6 */
          function sign(msg, secretKey, options = {}) {
              msg = ensureBytes('message', msg);
              if (prehash)
                  msg = prehash(msg); // for ed25519ph etc.
              const { prefix, scalar, pointBytes } = getExtendedPublicKey(secretKey);
              const r = hashDomainToScalar(options.context, prefix, msg); // r = dom2(F, C) || prefix || PH(M)
              const R = G.multiply(r).toBytes(); // R = rG
              const k = hashDomainToScalar(options.context, R, pointBytes, msg); // R || A || PH(M)
              const s = modN(r + k * scalar); // S = (r + k * s) mod L
              aInRange('signature.s', s, _0n, CURVE_ORDER); // 0 <= s < l
              const L = Fp.BYTES;
              const res = concatBytes$1(R, numberToBytesLE(s, L));
              return ensureBytes('result', res, L * 2); // 64-byte signature
          }
          // verification rule is either zip215 or rfc8032 / nist186-5. Consult fromHex:
          const verifyOpts = { zip215: true };
          /**
           * Verifies EdDSA signature against message and public key. RFC8032 5.1.7.
           * An extended group equation is checked.
           */
          function verify(sig, msg, publicKey, options = verifyOpts) {
              const { context, zip215 } = options;
              const len = Fp.BYTES; // Verifies EdDSA signature against message and public key. RFC8032 5.1.7.
              sig = ensureBytes('signature', sig, 2 * len); // An extended group equation is checked.
              msg = ensureBytes('message', msg);
              publicKey = ensureBytes('publicKey', publicKey, len);
              if (zip215 !== undefined)
                  abool('zip215', zip215);
              if (prehash)
                  msg = prehash(msg); // for ed25519ph, etc
              const s = bytesToNumberLE(sig.slice(len, 2 * len));
              let A, R, SB;
              try {
                  // zip215=true is good for consensus-critical apps. =false follows RFC8032 / NIST186-5.
                  // zip215=true:  0 <= y < MASK (2^256 for ed25519)
                  // zip215=false: 0 <= y < P (2^255-19 for ed25519)
                  A = Point.fromHex(publicKey, zip215);
                  R = Point.fromHex(sig.slice(0, len), zip215);
                  SB = G.multiplyUnsafe(s); // 0 <= s < l is done inside
              }
              catch (error) {
                  return false;
              }
              if (!zip215 && A.isSmallOrder())
                  return false;
              const k = hashDomainToScalar(context, R.toBytes(), A.toBytes(), msg);
              const RkA = R.add(A.multiplyUnsafe(k));
              // Extended group equation
              // [8][S]B = [8]R + [8][k]A'
              return RkA.subtract(SB).clearCofactor().is0();
          }
          G.precompute(8); // Enable precomputes. Slows down first publicKey computation by 20ms.
          const size = Fp.BYTES;
          const lengths = {
              secret: size,
              public: size,
              signature: 2 * size,
              seed: size,
          };
          function randomSecretKey(seed = randomBytes_(lengths.seed)) {
              return seed;
          }
          const utils = {
              getExtendedPublicKey,
              /** ed25519 priv keys are uniform 32b. No need to check for modulo bias, like in secp256k1. */
              randomSecretKey,
              isValidSecretKey,
              isValidPublicKey,
              randomPrivateKey: randomSecretKey,
              /**
               * Converts ed public key to x public key. Uses formula:
               * - ed25519:
               *   - `(u, v) = ((1+y)/(1-y), sqrt(-486664)*u/x)`
               *   - `(x, y) = (sqrt(-486664)*u/v, (u-1)/(u+1))`
               * - ed448:
               *   - `(u, v) = ((y-1)/(y+1), sqrt(156324)*u/x)`
               *   - `(x, y) = (sqrt(156324)*u/v, (1+u)/(1-u))`
               *
               * There is NO `fromMontgomery`:
               * - There are 2 valid ed25519 points for every x25519, with flipped coordinate
               * - Sometimes there are 0 valid ed25519 points, because x25519 *additionally*
               *   accepts inputs on the quadratic twist, which can't be moved to ed25519
               */
              toMontgomery(publicKey) {
                  const { y } = Point.fromBytes(publicKey);
                  const is25519 = size === 32;
                  if (!is25519 && size !== 57)
                      throw new Error('only defined for 25519 and 448');
                  const u = is25519 ? Fp.div(_1n$1 + y, _1n$1 - y) : Fp.div(y - _1n$1, y + _1n$1);
                  return Fp.toBytes(u);
              },
              toMontgomeryPriv(privateKey) {
                  abytes(privateKey, size);
                  const hashed = cHash(privateKey.subarray(0, size));
                  return adjustScalarBytes(hashed).subarray(0, size);
              },
              /**
               * We're doing scalar multiplication (used in getPublicKey etc) with precomputed BASE_POINT
               * values. This slows down first getPublicKey() by milliseconds (see Speed section),
               * but allows to speed-up subsequent getPublicKey() calls up to 20x.
               * @param windowSize 2, 4, 8, 16
               */
              precompute(windowSize = 8, point = Point.BASE) {
                  return point.precompute(windowSize, false);
              },
          };
          function keygen(seed) {
              const secretKey = utils.randomSecretKey(seed);
              return { secretKey, publicKey: getPublicKey(secretKey) };
          }
          function isValidSecretKey(key) {
              try {
                  return !!Fn.fromBytes(key, false);
              }
              catch (error) {
                  return false;
              }
          }
          function isValidPublicKey(key, zip215) {
              try {
                  return !!Point.fromBytes(key, zip215);
              }
              catch (error) {
                  return false;
              }
          }
          return Object.freeze({
              keygen,
              getPublicKey,
              sign,
              verify,
              utils,
              Point,
              info: { type: 'edwards', lengths },
          });
      }
      // TODO: remove
      function _eddsa_legacy_opts_to_new(c) {
          const CURVE = {
              a: c.a,
              d: c.d,
              p: c.Fp.ORDER,
              n: c.n,
              h: c.h,
              Gx: c.Gx,
              Gy: c.Gy,
          };
          const Fp = c.Fp;
          const Fn = Field(CURVE.n, c.nBitLength, true);
          const curveOpts = { Fp, Fn, uvRatio: c.uvRatio };
          const eddsaOpts = {
              randomBytes: c.randomBytes,
              adjustScalarBytes: c.adjustScalarBytes,
              domain: c.domain,
              prehash: c.prehash,
              mapToCurve: c.mapToCurve,
          };
          return { CURVE, curveOpts, hash: c.hash, eddsaOpts };
      }
      // TODO: remove
      function _eddsa_new_output_to_legacy(c, eddsa) {
          const legacy = Object.assign({}, eddsa, { ExtendedPoint: eddsa.Point, CURVE: c });
          return legacy;
      }
      // TODO: remove. Use eddsa
      function twistedEdwards(c) {
          const { CURVE, curveOpts, hash, eddsaOpts } = _eddsa_legacy_opts_to_new(c);
          const Point = edwards(CURVE, curveOpts);
          const EDDSA = eddsa(Point, hash, eddsaOpts);
          return _eddsa_new_output_to_legacy(c, EDDSA);
      }

      /**
       * ed25519 Twisted Edwards curve with following addons:
       * - X25519 ECDH
       * - Ristretto cofactor elimination
       * - Elligator hash-to-group / point indistinguishability
       * @module
       */
      /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
      // prettier-ignore
      BigInt(0); const _1n = BigInt(1), _2n = BigInt(2); BigInt(3);
      // prettier-ignore
      const _5n = BigInt(5), _8n = BigInt(8);
      // P = 2n**255n - 19n
      // N = 2n**252n + 27742317777372353535851937790883648493n
      // a = Fp.create(BigInt(-1))
      // d = -121665/121666 a.k.a. Fp.neg(121665 * Fp.inv(121666))
      const ed25519_CURVE = {
          p: BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed'),
          n: BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed'),
          h: _8n,
          a: BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec'),
          d: BigInt('0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3'),
          Gx: BigInt('0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a'),
          Gy: BigInt('0x6666666666666666666666666666666666666666666666666666666666666658'),
      };
      function ed25519_pow_2_252_3(x) {
          // prettier-ignore
          const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
          const P = ed25519_CURVE.p;
          const x2 = (x * x) % P;
          const b2 = (x2 * x) % P; // x^3, 11
          const b4 = (pow2(b2, _2n, P) * b2) % P; // x^15, 1111
          const b5 = (pow2(b4, _1n, P) * x) % P; // x^31
          const b10 = (pow2(b5, _5n, P) * b5) % P;
          const b20 = (pow2(b10, _10n, P) * b10) % P;
          const b40 = (pow2(b20, _20n, P) * b20) % P;
          const b80 = (pow2(b40, _40n, P) * b40) % P;
          const b160 = (pow2(b80, _80n, P) * b80) % P;
          const b240 = (pow2(b160, _80n, P) * b80) % P;
          const b250 = (pow2(b240, _10n, P) * b10) % P;
          const pow_p_5_8 = (pow2(b250, _2n, P) * x) % P;
          // ^ To pow to (p+3)/8, multiply it by x.
          return { pow_p_5_8, b2 };
      }
      function adjustScalarBytes(bytes) {
          // Section 5: For X25519, in order to decode 32 random bytes as an integer scalar,
          // set the three least significant bits of the first byte
          bytes[0] &= 248; // 0b1111_1000
          // and the most significant bit of the last to zero,
          bytes[31] &= 127; // 0b0111_1111
          // set the second most significant bit of the last byte to 1
          bytes[31] |= 64; // 0b0100_0000
          return bytes;
      }
      // √(-1) aka √(a) aka 2^((p-1)/4)
      // Fp.sqrt(Fp.neg(1))
      const ED25519_SQRT_M1 = /* @__PURE__ */ BigInt('19681161376707505956807079304988542015446066515923890162744021073123829784752');
      // sqrt(u/v)
      function uvRatio(u, v) {
          const P = ed25519_CURVE.p;
          const v3 = mod(v * v * v, P); // v³
          const v7 = mod(v3 * v3 * v, P); // v⁷
          // (p+3)/8 and (p-5)/8
          const pow = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
          let x = mod(u * v3 * pow, P); // (uv³)(uv⁷)^(p-5)/8
          const vx2 = mod(v * x * x, P); // vx²
          const root1 = x; // First root candidate
          const root2 = mod(x * ED25519_SQRT_M1, P); // Second root candidate
          const useRoot1 = vx2 === u; // If vx² = u (mod p), x is a square root
          const useRoot2 = vx2 === mod(-u, P); // If vx² = -u, set x <-- x * 2^((p-1)/4)
          const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P); // There is no valid root, vx² = -u√(-1)
          if (useRoot1)
              x = root1;
          if (useRoot2 || noRoot)
              x = root2; // We return root2 anyway, for const-time
          if (isNegativeLE(x, P))
              x = mod(-x, P);
          return { isValid: useRoot1 || useRoot2, value: x };
      }
      const Fp = /* @__PURE__ */ (() => Field(ed25519_CURVE.p, { isLE: true }))();
      const ed25519Defaults = /* @__PURE__ */ (() => ({
          ...ed25519_CURVE,
          Fp,
          hash: sha512$1,
          adjustScalarBytes,
          // dom2
          // Ratio of u to v. Allows us to combine inversion and square root. Uses algo from RFC8032 5.1.3.
          // Constant-time, u/√v
          uvRatio,
      }))();
      /**
       * ed25519 curve with EdDSA signatures.
       * @example
       * import { ed25519 } from '@noble/curves/ed25519';
       * const { secretKey, publicKey } = ed25519.keygen();
       * const msg = new TextEncoder().encode('hello');
       * const sig = ed25519.sign(msg, priv);
       * ed25519.verify(sig, msg, pub); // Default mode: follows ZIP215
       * ed25519.verify(sig, msg, pub, { zip215: false }); // RFC8032 / FIPS 186-5
       */
      const ed25519 = /* @__PURE__ */ (() => twistedEdwards(ed25519Defaults))();

      function messageWithIntent(scope, message) {
        return suiBcs.IntentMessage(suiBcs.fixedArray(message.length, suiBcs.u8())).serialize({
          intent: {
            scope: { [scope]: true },
            version: { V0: true },
            appId: { Sui: true }
          },
          value: message
        }).toBytes();
      }

      const SIGNATURE_SCHEME_TO_FLAG = {
        ED25519: 0,
        Secp256k1: 1,
        Secp256r1: 2,
        MultiSig: 3,
        ZkLogin: 5,
        Passkey: 6
      };
      const SIGNATURE_SCHEME_TO_SIZE = {
        ED25519: 32,
        Secp256k1: 33,
        Secp256r1: 33,
        Passkey: 33
      };
      const SIGNATURE_FLAG_TO_SCHEME = {
        0: "ED25519",
        1: "Secp256k1",
        2: "Secp256r1",
        3: "MultiSig",
        5: "ZkLogin",
        6: "Passkey"
      };

      /**
       * HMAC: RFC2104 message authentication code.
       * @module
       */
      class HMAC extends Hash {
          constructor(hash, _key) {
              super();
              this.finished = false;
              this.destroyed = false;
              ahash(hash);
              const key = toBytes(_key);
              this.iHash = hash.create();
              if (typeof this.iHash.update !== 'function')
                  throw new Error('Expected instance of class which extends utils.Hash');
              this.blockLen = this.iHash.blockLen;
              this.outputLen = this.iHash.outputLen;
              const blockLen = this.blockLen;
              const pad = new Uint8Array(blockLen);
              // blockLen can be bigger than outputLen
              pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
              for (let i = 0; i < pad.length; i++)
                  pad[i] ^= 0x36;
              this.iHash.update(pad);
              // By doing update (processing of first block) of outer hash here we can re-use it between multiple calls via clone
              this.oHash = hash.create();
              // Undo internal XOR && apply outer XOR
              for (let i = 0; i < pad.length; i++)
                  pad[i] ^= 0x36 ^ 0x5c;
              this.oHash.update(pad);
              clean(pad);
          }
          update(buf) {
              aexists(this);
              this.iHash.update(buf);
              return this;
          }
          digestInto(out) {
              aexists(this);
              abytes(out, this.outputLen);
              this.finished = true;
              this.iHash.digestInto(out);
              this.oHash.update(out);
              this.oHash.digestInto(out);
              this.destroy();
          }
          digest() {
              const out = new Uint8Array(this.oHash.outputLen);
              this.digestInto(out);
              return out;
          }
          _cloneInto(to) {
              // Create new instance without calling constructor since key already in state and we don't know it.
              to || (to = Object.create(Object.getPrototypeOf(this), {}));
              const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
              to = to;
              to.finished = finished;
              to.destroyed = destroyed;
              to.blockLen = blockLen;
              to.outputLen = outputLen;
              to.oHash = oHash._cloneInto(to.oHash);
              to.iHash = iHash._cloneInto(to.iHash);
              return to;
          }
          clone() {
              return this._cloneInto();
          }
          destroy() {
              this.destroyed = true;
              this.oHash.destroy();
              this.iHash.destroy();
          }
      }
      /**
       * HMAC: RFC2104 message authentication code.
       * @param hash - function that would be used e.g. sha256
       * @param key - message key
       * @param message - message data
       * @example
       * import { hmac } from '@noble/hashes/hmac';
       * import { sha256 } from '@noble/hashes/sha2';
       * const mac1 = hmac(sha256, 'key', 'message');
       */
      const hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
      hmac.create = (hash, key) => new HMAC(hash, key);

      function bytesEqual$1(a, b) {
        if (a === b) return true;
        if (a.length !== b.length) {
          return false;
        }
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) {
            return false;
          }
        }
        return true;
      }
      class PublicKey {
        /**
         * Checks if two public keys are equal
         */
        equals(publicKey) {
          return bytesEqual$1(this.toRawBytes(), publicKey.toRawBytes());
        }
        /**
         * Return the base-64 representation of the public key
         */
        toBase64() {
          return toBase64(this.toRawBytes());
        }
        toString() {
          throw new Error(
            "`toString` is not implemented on public keys. Use `toBase64()` or `toRawBytes()` instead."
          );
        }
        /**
         * Return the Sui representation of the public key encoded in
         * base-64. A Sui public key is formed by the concatenation
         * of the scheme flag with the raw bytes of the public key
         */
        toSuiPublicKey() {
          const bytes = this.toSuiBytes();
          return toBase64(bytes);
        }
        verifyWithIntent(bytes, signature, intent) {
          const intentMessage = messageWithIntent(intent, bytes);
          const digest = blake2b(intentMessage, { dkLen: 32 });
          return this.verify(digest, signature);
        }
        /**
         * Verifies that the signature is valid for for the provided PersonalMessage
         */
        verifyPersonalMessage(message, signature) {
          return this.verifyWithIntent(
            suiBcs.vector(suiBcs.u8()).serialize(message).toBytes(),
            signature,
            "PersonalMessage"
          );
        }
        /**
         * Verifies that the signature is valid for for the provided Transaction
         */
        verifyTransaction(transaction, signature) {
          return this.verifyWithIntent(transaction, signature, "TransactionData");
        }
        /**
         * Verifies that the public key is associated with the provided address
         */
        verifyAddress(address) {
          return this.toSuiAddress() === address;
        }
        /**
         * Returns the bytes representation of the public key
         * prefixed with the signature scheme flag
         */
        toSuiBytes() {
          const rawBytes = this.toRawBytes();
          const suiBytes = new Uint8Array(rawBytes.length + 1);
          suiBytes.set([this.flag()]);
          suiBytes.set(rawBytes, 1);
          return suiBytes;
        }
        /**
         * Return the Sui address associated with this Ed25519 public key
         */
        toSuiAddress() {
          return normalizeSuiAddress(
            bytesToHex(blake2b(this.toSuiBytes(), { dkLen: 32 })).slice(0, SUI_ADDRESS_LENGTH * 2)
          );
        }
      }
      function parseSerializedKeypairSignature(serializedSignature) {
        const bytes = fromBase64(serializedSignature);
        const signatureScheme = SIGNATURE_FLAG_TO_SCHEME[bytes[0]];
        switch (signatureScheme) {
          case "ED25519":
          case "Secp256k1":
          case "Secp256r1":
            const size = SIGNATURE_SCHEME_TO_SIZE[signatureScheme];
            const signature = bytes.slice(1, bytes.length - size);
            const publicKey = bytes.slice(1 + signature.length);
            return {
              serializedSignature,
              signatureScheme,
              signature,
              publicKey,
              bytes
            };
          default:
            throw new Error("Unsupported signature scheme");
        }
      }

      function toSerializedSignature({
        signature,
        signatureScheme,
        publicKey
      }) {
        if (!publicKey) {
          throw new Error("`publicKey` is required");
        }
        const pubKeyBytes = publicKey.toRawBytes();
        const serializedSignature = new Uint8Array(1 + signature.length + pubKeyBytes.length);
        serializedSignature.set([SIGNATURE_SCHEME_TO_FLAG[signatureScheme]]);
        serializedSignature.set(signature, 1);
        serializedSignature.set(pubKeyBytes, 1 + signature.length);
        return toBase64(serializedSignature);
      }

      const PRIVATE_KEY_SIZE = 32;
      const SUI_PRIVATE_KEY_PREFIX = "suiprivkey";
      class Signer {
        /**
         * Sign messages with a specific intent. By combining the message bytes with the intent before hashing and signing,
         * it ensures that a signed message is tied to a specific purpose and domain separator is provided
         */
        async signWithIntent(bytes, intent) {
          const intentMessage = messageWithIntent(intent, bytes);
          const digest = blake2b(intentMessage, { dkLen: 32 });
          const signature = toSerializedSignature({
            signature: await this.sign(digest),
            signatureScheme: this.getKeyScheme(),
            publicKey: this.getPublicKey()
          });
          return {
            signature,
            bytes: toBase64(bytes)
          };
        }
        /**
         * Signs provided transaction by calling `signWithIntent()` with a `TransactionData` provided as intent scope
         */
        async signTransaction(bytes) {
          return this.signWithIntent(bytes, "TransactionData");
        }
        /**
         * Signs provided personal message by calling `signWithIntent()` with a `PersonalMessage` provided as intent scope
         */
        async signPersonalMessage(bytes) {
          const { signature } = await this.signWithIntent(
            bcs.vector(bcs.u8()).serialize(bytes).toBytes(),
            "PersonalMessage"
          );
          return {
            bytes: toBase64(bytes),
            signature
          };
        }
        async signAndExecuteTransaction({
          transaction,
          client
        }) {
          const bytes = await transaction.build({ client });
          const { signature } = await this.signTransaction(bytes);
          const response = await client.core.executeTransaction({
            transaction: bytes,
            signatures: [signature]
          });
          return response.transaction;
        }
        toSuiAddress() {
          return this.getPublicKey().toSuiAddress();
        }
      }
      class Keypair extends Signer {
      }
      function decodeSuiPrivateKey(value) {
        const { prefix, words } = bech32.decode(value);
        if (prefix !== SUI_PRIVATE_KEY_PREFIX) {
          throw new Error("invalid private key prefix");
        }
        const extendedSecretKey = new Uint8Array(bech32.fromWords(words));
        const secretKey = extendedSecretKey.slice(1);
        const signatureScheme = SIGNATURE_FLAG_TO_SCHEME[extendedSecretKey[0]];
        return {
          scheme: signatureScheme,
          schema: signatureScheme,
          secretKey
        };
      }
      function encodeSuiPrivateKey(bytes, scheme) {
        if (bytes.length !== PRIVATE_KEY_SIZE) {
          throw new Error("Invalid bytes length");
        }
        const flag = SIGNATURE_SCHEME_TO_FLAG[scheme];
        const privKeyBytes = new Uint8Array(bytes.length + 1);
        privKeyBytes.set([flag]);
        privKeyBytes.set(bytes, 1);
        return bech32.encode(SUI_PRIVATE_KEY_PREFIX, bech32.toWords(privKeyBytes));
      }

      /**
       * PBKDF (RFC 2898). Can be used to create a key from password and salt.
       * @module
       */
      // Common prologue and epilogue for sync/async functions
      function pbkdf2Init(hash, _password, _salt, _opts) {
          ahash(hash);
          const opts = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
          const { c, dkLen, asyncTick } = opts;
          anumber(c);
          anumber(dkLen);
          anumber(asyncTick);
          if (c < 1)
              throw new Error('iterations (c) should be >= 1');
          const password = kdfInputToBytes(_password);
          const salt = kdfInputToBytes(_salt);
          // DK = PBKDF2(PRF, Password, Salt, c, dkLen);
          const DK = new Uint8Array(dkLen);
          // U1 = PRF(Password, Salt + INT_32_BE(i))
          const PRF = hmac.create(hash, password);
          const PRFSalt = PRF._cloneInto().update(salt);
          return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
      }
      function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
          PRF.destroy();
          PRFSalt.destroy();
          if (prfW)
              prfW.destroy();
          clean(u);
          return DK;
      }
      /**
       * PBKDF2-HMAC: RFC 2898 key derivation function
       * @param hash - hash function that would be used e.g. sha256
       * @param password - password from which a derived key is generated
       * @param salt - cryptographic salt
       * @param opts - {c, dkLen} where c is work factor and dkLen is output message size
       * @example
       * const key = pbkdf2(sha256, 'password', 'salt', { dkLen: 32, c: Math.pow(2, 18) });
       */
      function pbkdf2(hash, password, salt, opts) {
          const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash, password, salt, opts);
          let prfW; // Working copy
          const arr = new Uint8Array(4);
          const view = createView(arr);
          const u = new Uint8Array(PRF.outputLen);
          // DK = T1 + T2 + ⋯ + Tdklen/hlen
          for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
              // Ti = F(Password, Salt, c, i)
              const Ti = DK.subarray(pos, pos + PRF.outputLen);
              view.setInt32(0, ti, false);
              // F(Password, Salt, c, i) = U1 ^ U2 ^ ⋯ ^ Uc
              // U1 = PRF(Password, Salt + INT_32_BE(i))
              (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
              Ti.set(u.subarray(0, Ti.length));
              for (let ui = 1; ui < c; ui++) {
                  // Uc = PRF(Password, Uc−1)
                  PRF._cloneInto(prfW).update(u).digestInto(u);
                  for (let i = 0; i < Ti.length; i++)
                      Ti[i] ^= u[i];
              }
          }
          return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
      }

      /**
       * Audited & minimal JS implementation of
       * [BIP39 mnemonic phrases](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki).
       * @module
       * @example
      ```js
      import * as bip39 from '@scure/bip39';
      import { wordlist } from '@scure/bip39/wordlists/english';
      const mn = bip39.generateMnemonic(wordlist);
      console.log(mn);
      const ent = bip39.mnemonicToEntropy(mn, wordlist)
      bip39.entropyToMnemonic(ent, wordlist);
      bip39.validateMnemonic(mn, wordlist);
      await bip39.mnemonicToSeed(mn, 'password');
      bip39.mnemonicToSeedSync(mn, 'password');

      // Wordlists
      import { wordlist as czech } from '@scure/bip39/wordlists/czech';
      import { wordlist as english } from '@scure/bip39/wordlists/english';
      import { wordlist as french } from '@scure/bip39/wordlists/french';
      import { wordlist as italian } from '@scure/bip39/wordlists/italian';
      import { wordlist as japanese } from '@scure/bip39/wordlists/japanese';
      import { wordlist as korean } from '@scure/bip39/wordlists/korean';
      import { wordlist as portuguese } from '@scure/bip39/wordlists/portuguese';
      import { wordlist as simplifiedChinese } from '@scure/bip39/wordlists/simplified-chinese';
      import { wordlist as spanish } from '@scure/bip39/wordlists/spanish';
      import { wordlist as traditionalChinese } from '@scure/bip39/wordlists/traditional-chinese';
      ```
       */
      /*! scure-bip39 - MIT License (c) 2022 Patricio Palladino, Paul Miller (paulmillr.com) */
      // Normalization replaces equivalent sequences of characters
      // so that any two texts that are equivalent will be reduced
      // to the same sequence of code points, called the normal form of the original text.
      // https://tonsky.me/blog/unicode/#why-is-a----
      function nfkd(str) {
          if (typeof str !== 'string')
              throw new TypeError('invalid mnemonic type: ' + typeof str);
          return str.normalize('NFKD');
      }
      function normalize(str) {
          const norm = nfkd(str);
          const words = norm.split(' ');
          if (![12, 15, 18, 21, 24].includes(words.length))
              throw new Error('Invalid mnemonic');
          return { nfkd: norm, words };
      }
      const psalt = (passphrase) => nfkd('mnemonic' + passphrase);
      /**
       * Irreversible: Uses KDF to derive 64 bytes of key data from mnemonic + optional password.
       * @param mnemonic 12-24 words
       * @param passphrase string that will additionally protect the key
       * @returns 64 bytes of key data
       * @example
       * const mnem = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
       * mnemonicToSeedSync(mnem, 'password');
       * // new Uint8Array([...64 bytes])
       */
      function mnemonicToSeedSync(mnemonic, passphrase = '') {
          return pbkdf2(sha512$1, normalize(mnemonic).nfkd, psalt(passphrase), { c: 2048, dkLen: 64 });
      }

      function isValidHardenedPath(path) {
        if (!new RegExp("^m\\/44'\\/784'\\/[0-9]+'\\/[0-9]+'\\/[0-9]+'+$").test(path)) {
          return false;
        }
        return true;
      }
      function mnemonicToSeed(mnemonics) {
        return mnemonicToSeedSync(mnemonics, "");
      }
      function mnemonicToSeedHex(mnemonics) {
        return toHex(mnemonicToSeed(mnemonics));
      }

      /**
       * SHA2-512 a.k.a. sha512 and sha384. It is slower than sha256 in js because u64 operations are slow.
       *
       * Check out [RFC 4634](https://datatracker.ietf.org/doc/html/rfc4634) and
       * [the paper on truncated SHA512/256](https://eprint.iacr.org/2010/548.pdf).
       * @module
       * @deprecated
       */
      /** @deprecated Use import from `noble/hashes/sha2` module */
      const sha512 = sha512$1;

      const ED25519_CURVE = "ed25519 seed";
      const HARDENED_OFFSET = 2147483648;
      const pathRegex = new RegExp("^m(\\/[0-9]+')+$");
      const replaceDerive = (val) => val.replace("'", "");
      const getMasterKeyFromSeed = (seed) => {
        const h = hmac.create(sha512, ED25519_CURVE);
        const I = h.update(fromHex(seed)).digest();
        const IL = I.slice(0, 32);
        const IR = I.slice(32);
        return {
          key: IL,
          chainCode: IR
        };
      };
      const CKDPriv = ({ key, chainCode }, index) => {
        const indexBuffer = new ArrayBuffer(4);
        const cv = new DataView(indexBuffer);
        cv.setUint32(0, index);
        const data = new Uint8Array(1 + key.length + indexBuffer.byteLength);
        data.set(new Uint8Array(1).fill(0));
        data.set(key, 1);
        data.set(new Uint8Array(indexBuffer, 0, indexBuffer.byteLength), key.length + 1);
        const I = hmac.create(sha512, chainCode).update(data).digest();
        const IL = I.slice(0, 32);
        const IR = I.slice(32);
        return {
          key: IL,
          chainCode: IR
        };
      };
      const isValidPath = (path) => {
        if (!pathRegex.test(path)) {
          return false;
        }
        return !path.split("/").slice(1).map(replaceDerive).some(
          isNaN
          /* ts T_T*/
        );
      };
      const derivePath = (path, seed, offset = HARDENED_OFFSET) => {
        if (!isValidPath(path)) {
          throw new Error("Invalid derivation path");
        }
        const { key, chainCode } = getMasterKeyFromSeed(seed);
        const segments = path.split("/").slice(1).map(replaceDerive).map((el) => parseInt(el, 10));
        return segments.reduce((parentKeys, segment) => CKDPriv(parentKeys, segment + offset), {
          key,
          chainCode
        });
      };

      const PUBLIC_KEY_SIZE = 32;
      class Ed25519PublicKey extends PublicKey {
        /**
         * Create a new Ed25519PublicKey object
         * @param value ed25519 public key as buffer or base-64 encoded string
         */
        constructor(value) {
          super();
          if (typeof value === "string") {
            this.data = fromBase64(value);
          } else if (value instanceof Uint8Array) {
            this.data = value;
          } else {
            this.data = Uint8Array.from(value);
          }
          if (this.data.length !== PUBLIC_KEY_SIZE) {
            throw new Error(
              `Invalid public key input. Expected ${PUBLIC_KEY_SIZE} bytes, got ${this.data.length}`
            );
          }
        }
        /**
         * Checks if two Ed25519 public keys are equal
         */
        equals(publicKey) {
          return super.equals(publicKey);
        }
        /**
         * Return the byte array representation of the Ed25519 public key
         */
        toRawBytes() {
          return this.data;
        }
        /**
         * Return the Sui address associated with this Ed25519 public key
         */
        flag() {
          return SIGNATURE_SCHEME_TO_FLAG["ED25519"];
        }
        /**
         * Verifies that the signature is valid for for the provided message
         */
        async verify(message, signature) {
          let bytes;
          if (typeof signature === "string") {
            const parsed = parseSerializedKeypairSignature(signature);
            if (parsed.signatureScheme !== "ED25519") {
              throw new Error("Invalid signature scheme");
            }
            if (!bytesEqual$1(this.toRawBytes(), parsed.publicKey)) {
              throw new Error("Signature does not match public key");
            }
            bytes = parsed.signature;
          } else {
            bytes = signature;
          }
          return ed25519.verify(bytes, message, this.toRawBytes());
        }
      } exports("Ed25519PublicKey", Ed25519PublicKey);
      Ed25519PublicKey.SIZE = PUBLIC_KEY_SIZE;

      const DEFAULT_ED25519_DERIVATION_PATH = exports("DEFAULT_ED25519_DERIVATION_PATH", "m/44'/784'/0'/0'/0'");
      class Ed25519Keypair extends Keypair {
        /**
         * Create a new Ed25519 keypair instance.
         * Generate random keypair if no {@link Ed25519Keypair} is provided.
         *
         * @param keypair Ed25519 keypair
         */
        constructor(keypair) {
          super();
          if (keypair) {
            this.keypair = {
              publicKey: keypair.publicKey,
              secretKey: keypair.secretKey.slice(0, 32)
            };
          } else {
            const privateKey = ed25519.utils.randomPrivateKey();
            this.keypair = {
              publicKey: ed25519.getPublicKey(privateKey),
              secretKey: privateKey
            };
          }
        }
        /**
         * Get the key scheme of the keypair ED25519
         */
        getKeyScheme() {
          return "ED25519";
        }
        /**
         * Generate a new random Ed25519 keypair
         */
        static generate() {
          const secretKey = ed25519.utils.randomPrivateKey();
          return new Ed25519Keypair({
            publicKey: ed25519.getPublicKey(secretKey),
            secretKey
          });
        }
        /**
         * Create a Ed25519 keypair from a raw secret key byte array, also known as seed.
         * This is NOT the private scalar which is result of hashing and bit clamping of
         * the raw secret key.
         *
         * @throws error if the provided secret key is invalid and validation is not skipped.
         *
         * @param secretKey secret key as a byte array or Bech32 secret key string
         * @param options: skip secret key validation
         */
        static fromSecretKey(secretKey, options) {
          if (typeof secretKey === "string") {
            const decoded = decodeSuiPrivateKey(secretKey);
            if (decoded.schema !== "ED25519") {
              throw new Error(`Expected a ED25519 keypair, got ${decoded.schema}`);
            }
            return this.fromSecretKey(decoded.secretKey, options);
          }
          const secretKeyLength = secretKey.length;
          if (secretKeyLength !== PRIVATE_KEY_SIZE) {
            throw new Error(
              `Wrong secretKey size. Expected ${PRIVATE_KEY_SIZE} bytes, got ${secretKeyLength}.`
            );
          }
          const keypair = {
            publicKey: ed25519.getPublicKey(secretKey),
            secretKey
          };
          if (!options || !options.skipValidation) {
            const encoder = new TextEncoder();
            const signData = encoder.encode("sui validation");
            const signature = ed25519.sign(signData, secretKey);
            if (!ed25519.verify(signature, signData, keypair.publicKey)) {
              throw new Error("provided secretKey is invalid");
            }
          }
          return new Ed25519Keypair(keypair);
        }
        /**
         * The public key for this Ed25519 keypair
         */
        getPublicKey() {
          return new Ed25519PublicKey(this.keypair.publicKey);
        }
        /**
         * The Bech32 secret key string for this Ed25519 keypair
         */
        getSecretKey() {
          return encodeSuiPrivateKey(
            this.keypair.secretKey.slice(0, PRIVATE_KEY_SIZE),
            this.getKeyScheme()
          );
        }
        /**
         * Return the signature for the provided data using Ed25519.
         */
        async sign(data) {
          return ed25519.sign(data, this.keypair.secretKey);
        }
        /**
         * Derive Ed25519 keypair from mnemonics and path. The mnemonics must be normalized
         * and validated against the english wordlist.
         *
         * If path is none, it will default to m/44'/784'/0'/0'/0', otherwise the path must
         * be compliant to SLIP-0010 in form m/44'/784'/{account_index}'/{change_index}'/{address_index}'.
         */
        static deriveKeypair(mnemonics, path) {
          if (path == null) {
            path = DEFAULT_ED25519_DERIVATION_PATH;
          }
          if (!isValidHardenedPath(path)) {
            throw new Error("Invalid derivation path");
          }
          const { key } = derivePath(path, mnemonicToSeedHex(mnemonics));
          return Ed25519Keypair.fromSecretKey(key);
        }
        /**
         * Derive Ed25519 keypair from mnemonicSeed and path.
         *
         * If path is none, it will default to m/44'/784'/0'/0'/0', otherwise the path must
         * be compliant to SLIP-0010 in form m/44'/784'/{account_index}'/{change_index}'/{address_index}'.
         */
        static deriveKeypairFromSeed(seedHex, path) {
          if (path == null) {
            path = DEFAULT_ED25519_DERIVATION_PATH;
          }
          if (!isValidHardenedPath(path)) {
            throw new Error("Invalid derivation path");
          }
          const { key } = derivePath(path, seedHex);
          return Ed25519Keypair.fromSecretKey(key);
        }
      } exports("Ed25519Keypair", Ed25519Keypair);

      class FaucetRateLimitError extends Error {
      } exports("FaucetRateLimitError", FaucetRateLimitError);
      async function faucetRequest({ host, path, body, headers, method }) {
        const endpoint = new URL(path, host).toString();
        const res = await fetch(endpoint, {
          method,
          body: body ? JSON.stringify(body) : void 0,
          headers: {
            "Content-Type": "application/json",
            ...headers
          }
        });
        if (res.status === 429) {
          throw new FaucetRateLimitError(
            `Too many requests from this client have been sent to the faucet. Please retry later`
          );
        }
        try {
          const parsed = await res.json();
          return parsed;
        } catch (e) {
          throw new Error(
            `Encountered error when parsing response from faucet, error: ${e}, status ${res.status}, response ${res}`
          );
        }
      }
      async function requestSuiFromFaucetV0(input) {
        const response = await faucetRequest({
          host: input.host,
          path: "/gas",
          body: {
            FixedAmountRequest: {
              recipient: input.recipient
            }
          },
          headers: input.headers,
          method: "POST"
        });
        if (response.error) {
          throw new Error(`Faucet request failed: ${response.error}`);
        }
        return response;
      }
      async function requestSuiFromFaucetV1(input) {
        const response = await faucetRequest({
          host: input.host,
          path: "/v1/gas",
          body: {
            FixedAmountRequest: {
              recipient: input.recipient
            }
          },
          headers: input.headers,
          method: "POST"
        });
        if (response.error) {
          throw new Error(`Faucet request failed: ${response.error}`);
        }
        return response;
      }
      async function requestSuiFromFaucetV2(input) {
        const response = await faucetRequest({
          host: input.host,
          path: "/v2/gas",
          body: {
            FixedAmountRequest: {
              recipient: input.recipient
            }
          },
          headers: input.headers,
          method: "POST"
        });
        if (response.status !== "Success") {
          throw new Error(`Faucet request failed: ${response.status.Failure.internal}`);
        }
        return response;
      }
      async function getFaucetRequestStatus(input) {
        const response = await faucetRequest({
          host: input.host,
          path: `/v1/status/${input.taskId}`,
          headers: input.headers,
          method: "GET"
        });
        if (response.error) {
          throw new Error(`Faucet request failed: ${response.error}`);
        }
        return response;
      }
      function getFaucetHost(network) {
        switch (network) {
          case "testnet":
            return "https://faucet.testnet.sui.io";
          case "devnet":
            return "https://faucet.devnet.sui.io";
          case "localnet":
            return "http://127.0.0.1:9123";
          default:
            throw new Error(`Unknown network: ${network}`);
        }
      }

      var __classPrivateFieldGet$2 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
          if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
          if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
          return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
      };
      var __classPrivateFieldSet$2 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
          if (kind === "m") throw new TypeError("Private method is not writable");
          if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
          if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
          return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
      };
      var _AppReadyEvent_detail;
      let wallets = undefined;
      const registeredWalletsSet = new Set();
      function addRegisteredWallet(wallet) {
          cachedWalletsArray = undefined;
          registeredWalletsSet.add(wallet);
      }
      function removeRegisteredWallet(wallet) {
          cachedWalletsArray = undefined;
          registeredWalletsSet.delete(wallet);
      }
      const listeners = {};
      /**
       * Get an API for {@link Wallets.get | getting}, {@link Wallets.on | listening for}, and
       * {@link Wallets.register | registering} {@link "@wallet-standard/base".Wallet | Wallets}.
       *
       * When called for the first time --
       *
       * This dispatches a {@link "@wallet-standard/base".WindowAppReadyEvent} to notify each Wallet that the app is ready
       * to register it.
       *
       * This also adds a listener for {@link "@wallet-standard/base".WindowRegisterWalletEvent} to listen for a notification
       * from each Wallet that the Wallet is ready to be registered by the app.
       *
       * This combination of event dispatch and listener guarantees that each Wallet will be registered synchronously as soon
       * as the app is ready whether the app loads before or after each Wallet.
       *
       * @return API for getting, listening for, and registering Wallets.
       *
       * @group App
       */
      function getWallets() {
          if (wallets)
              return wallets;
          wallets = Object.freeze({ register, get, on });
          if (typeof window === 'undefined')
              return wallets;
          const api = Object.freeze({ register });
          try {
              window.addEventListener('wallet-standard:register-wallet', ({ detail: callback }) => callback(api));
          }
          catch (error) {
              console.error('wallet-standard:register-wallet event listener could not be added\n', error);
          }
          try {
              window.dispatchEvent(new AppReadyEvent(api));
          }
          catch (error) {
              console.error('wallet-standard:app-ready event could not be dispatched\n', error);
          }
          return wallets;
      }
      function register(...wallets) {
          // Filter out wallets that have already been registered.
          // This prevents the same wallet from being registered twice, but it also prevents wallets from being
          // unregistered by reusing a reference to the wallet to obtain the unregister function for it.
          wallets = wallets.filter((wallet) => !registeredWalletsSet.has(wallet));
          // If there are no new wallets to register, just return a no-op unregister function.
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          if (!wallets.length)
              return () => { };
          wallets.forEach((wallet) => addRegisteredWallet(wallet));
          listeners['register']?.forEach((listener) => guard$1(() => listener(...wallets)));
          // Return a function that unregisters the registered wallets.
          return function unregister() {
              wallets.forEach((wallet) => removeRegisteredWallet(wallet));
              listeners['unregister']?.forEach((listener) => guard$1(() => listener(...wallets)));
          };
      }
      let cachedWalletsArray;
      function get() {
          if (!cachedWalletsArray) {
              cachedWalletsArray = [...registeredWalletsSet];
          }
          return cachedWalletsArray;
      }
      function on(event, listener) {
          listeners[event]?.push(listener) || (listeners[event] = [listener]);
          // Return a function that removes the event listener.
          return function off() {
              listeners[event] = listeners[event]?.filter((existingListener) => listener !== existingListener);
          };
      }
      function guard$1(callback) {
          try {
              callback();
          }
          catch (error) {
              console.error(error);
          }
      }
      class AppReadyEvent extends Event {
          get detail() {
              return __classPrivateFieldGet$2(this, _AppReadyEvent_detail, "f");
          }
          get type() {
              return 'wallet-standard:app-ready';
          }
          constructor(api) {
              super('wallet-standard:app-ready', {
                  bubbles: false,
                  cancelable: false,
                  composed: false,
              });
              _AppReadyEvent_detail.set(this, void 0);
              __classPrivateFieldSet$2(this, _AppReadyEvent_detail, api, "f");
          }
          /** @deprecated */
          preventDefault() {
              throw new Error('preventDefault cannot be called');
          }
          /** @deprecated */
          stopImmediatePropagation() {
              throw new Error('stopImmediatePropagation cannot be called');
          }
          /** @deprecated */
          stopPropagation() {
              throw new Error('stopPropagation cannot be called');
          }
      }
      _AppReadyEvent_detail = new WeakMap();
      /**
       * @deprecated Use {@link getWallets} instead.
       *
       * @group Deprecated
       */
      function DEPRECATED_getWallets() {
          if (wallets)
              return wallets;
          wallets = getWallets();
          if (typeof window === 'undefined')
              return wallets;
          const callbacks = window.navigator.wallets || [];
          if (!Array.isArray(callbacks)) {
              console.error('window.navigator.wallets is not an array');
              return wallets;
          }
          const { register } = wallets;
          const push = (...callbacks) => callbacks.forEach((callback) => guard$1(() => callback({ register })));
          try {
              Object.defineProperty(window.navigator, 'wallets', {
                  value: Object.freeze({ push }),
              });
          }
          catch (error) {
              console.error('window.navigator.wallets could not be set');
              return wallets;
          }
          push(...callbacks);
          return wallets;
      }

      /**
       * To add a new error, follow the instructions at
       * https://github.com/wallet-standard/wallet-standard/tree/master/packages/core/errors/#adding-a-new-error
       *
       * WARNING:
       *   - Don't remove error codes
       *   - Don't change or reorder error codes.
       *
       * Good naming conventions:
       *   - Prefixing common errors — e.g. under the same package — can be a good way to namespace them. E.g. All codec-related errors start with `WALLET_STANDARD_ERROR__ACCOUNT__`.
       *   - Use consistent names — e.g. choose `PDA` or `PROGRAM_DERIVED_ADDRESS` and stick with it. Ensure your names are consistent with existing error codes. The decision might have been made for you.
       *   - Recommended prefixes and suffixes:
       *     - `MALFORMED_`: Some input was not constructed properly. E.g. `MALFORMED_BASE58_ENCODED_ADDRESS`.
       *     - `INVALID_`: Some input is invalid (other than because it was MALFORMED). E.g. `INVALID_NUMBER_OF_BYTES`.
       *     - `EXPECTED_`: Some input was different than expected, no need to specify the "GOT" part unless necessary. E.g. `EXPECTED_DECODED_ACCOUNT`.
       *     - `_CANNOT_`: Some operation cannot be performed or some input cannot be used due to some condition. E.g. `CANNOT_DECODE_EMPTY_BYTE_ARRAY` or `PDA_CANNOT_END_WITH_PDA_MARKER`.
       *     - `_MUST_BE_`: Some condition must be true. E.g. `NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE`.
       *     - `_FAILED_TO_`: Tried to perform some operation and failed. E.g. `FAILED_TO_DECODE_ACCOUNT`.
       *     - `_NOT_FOUND`: Some operation lead to not finding something. E.g. `ACCOUNT_NOT_FOUND`.
       *     - `_OUT_OF_RANGE`: Some value is out of range. E.g. `ENUM_DISCRIMINATOR_OUT_OF_RANGE`.
       *     - `_EXCEEDED`: Some limit was exceeded. E.g. `PDA_MAX_SEED_LENGTH_EXCEEDED`.
       *     - `_MISMATCH`: Some elements do not match. E.g. `ENCODER_DECODER_FIXED_SIZE_MISMATCH`.
       *     - `_MISSING`: Some required input is missing. E.g. `TRANSACTION_FEE_PAYER_MISSING`.
       *     - `_UNIMPLEMENTED`: Some required component is not available in the environment. E.g. `SUBTLE_CRYPTO_VERIFY_FUNCTION_UNIMPLEMENTED`.
       */
      // Registry-related errors.
      // Reserve error codes in the range [3834000-3834999].
      const WALLET_STANDARD_ERROR__REGISTRY__WALLET_NOT_FOUND = exports("WALLET_STANDARD_ERROR__REGISTRY__WALLET_NOT_FOUND", 3834000);
      const WALLET_STANDARD_ERROR__REGISTRY__WALLET_ACCOUNT_NOT_FOUND = exports("WALLET_STANDARD_ERROR__REGISTRY__WALLET_ACCOUNT_NOT_FOUND", 3834001);
      // User-related errors.
      // Reserve error codes in the range [4001000-4001999].
      const WALLET_STANDARD_ERROR__USER__REQUEST_REJECTED = exports("WALLET_STANDARD_ERROR__USER__REQUEST_REJECTED", 4001000);
      // Feature-related errors.
      // Reserve error codes in the range [6160000-6160999].
      const WALLET_STANDARD_ERROR__FEATURES__WALLET_ACCOUNT_CHAIN_UNSUPPORTED = exports("WALLET_STANDARD_ERROR__FEATURES__WALLET_ACCOUNT_CHAIN_UNSUPPORTED", 6160000);
      const WALLET_STANDARD_ERROR__FEATURES__WALLET_ACCOUNT_FEATURE_UNIMPLEMENTED = exports("WALLET_STANDARD_ERROR__FEATURES__WALLET_ACCOUNT_FEATURE_UNIMPLEMENTED", 6160001);
      const WALLET_STANDARD_ERROR__FEATURES__WALLET_FEATURE_UNIMPLEMENTED = exports("WALLET_STANDARD_ERROR__FEATURES__WALLET_FEATURE_UNIMPLEMENTED", 6160002);

      function encodeValue(value) {
          if (Array.isArray(value)) {
              const commaSeparatedValues = value.map(encodeValue).join('%2C%20' /* ", " */);
              return '%5B' /* "[" */ + commaSeparatedValues + /* "]" */ '%5D';
          }
          else if (typeof value === 'bigint') {
              return `${value}n`;
          }
          else {
              return encodeURIComponent(String(value != null && Object.getPrototypeOf(value) === null
                  ? // Plain objects with no prototype don't have a `toString` method.
                      // Convert them before stringifying them.
                      { ...value }
                  : value));
          }
      }
      function encodeObjectContextEntry([key, value]) {
          return `${key}=${encodeValue(value)}`;
      }
      function encodeContextObject(context) {
          const searchParamsString = Object.entries(context).map(encodeObjectContextEntry).join('&');
          return btoa(searchParamsString);
      }

      var StateType;
      (function (StateType) {
          StateType[StateType["EscapeSequence"] = 0] = "EscapeSequence";
          StateType[StateType["Text"] = 1] = "Text";
          StateType[StateType["Variable"] = 2] = "Variable";
      })(StateType || (StateType = {}));
      function getErrorMessage(code, context = {}) {
          {
              let decodingAdviceMessage = `Wallet Standard error #${code}; Decode this error by running \`npx @wallet-standard/errors decode -- ${code}`;
              if (Object.keys(context).length) {
                  /**
                   * DANGER: Be sure that the shell command is escaped in such a way that makes it
                   *         impossible for someone to craft malicious context values that would result in
                   *         an exploit against anyone who bindly copy/pastes it into their terminal.
                   */
                  decodingAdviceMessage += ` '${encodeContextObject(context)}'`;
              }
              return `${decodingAdviceMessage}\``;
          }
      }

      function isWalletStandardError(e, code) {
          const isWalletStandardError = e instanceof Error && e.name === 'WalletStandardError';
          if (isWalletStandardError) {
              if (code !== undefined) {
                  return e.context.__code === code;
              }
              return true;
          }
          return false;
      }
      class WalletStandardError extends Error {
          constructor(...[code, contextAndErrorOptions]) {
              let context;
              let errorOptions;
              if (contextAndErrorOptions) {
                  // If the `ErrorOptions` type ever changes, update this code.
                  const { cause, ...contextRest } = contextAndErrorOptions;
                  if (cause) {
                      errorOptions = { cause };
                  }
                  if (Object.keys(contextRest).length > 0) {
                      context = contextRest;
                  }
              }
              const message = getErrorMessage(code, context);
              super(message, errorOptions);
              this.context = {
                  __code: code,
                  ...context,
              };
              // This is necessary so that `isWalletStandardError()` can identify a `WalletStandardError`
              // without having to import the class for use in an `instanceof` check.
              this.name = 'WalletStandardError';
          }
      } exports("WalletStandardError", WalletStandardError);

      function safeCaptureStackTrace(...args) {
          if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
              Error.captureStackTrace(...args);
          }
      }

      /** Name of the feature. */
      const StandardConnect = exports("StandardConnect", 'standard:connect');
      /**
       * @deprecated Use {@link StandardConnect} instead.
       *
       * @group Deprecated
       */
      const Connect = exports("Connect", StandardConnect);

      /** Name of the feature. */
      const StandardDisconnect = exports("StandardDisconnect", 'standard:disconnect');
      /**
       * @deprecated Use {@link StandardDisconnect} instead.
       *
       * @group Deprecated
       */
      const Disconnect = exports("Disconnect", StandardDisconnect);

      /** Name of the feature. */
      const StandardEvents = exports("StandardEvents", 'standard:events');
      /**
       * @deprecated Use {@link StandardEvents} instead.
       *
       * @group Deprecated
       */
      const Events = exports("Events", StandardEvents);

      var __classPrivateFieldGet$1 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
          if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
          if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
          return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
      };
      var __classPrivateFieldSet$1 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
          if (kind === "m") throw new TypeError("Private method is not writable");
          if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
          if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
          return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
      };
      var _RegisterWalletEvent_detail;
      /**
       * Register a {@link "@wallet-standard/base".Wallet} as a Standard Wallet with the app.
       *
       * This dispatches a {@link "@wallet-standard/base".WindowRegisterWalletEvent} to notify the app that the Wallet is
       * ready to be registered.
       *
       * This also adds a listener for {@link "@wallet-standard/base".WindowAppReadyEvent} to listen for a notification from
       * the app that the app is ready to register the Wallet.
       *
       * This combination of event dispatch and listener guarantees that the Wallet will be registered synchronously as soon
       * as the app is ready whether the Wallet loads before or after the app.
       *
       * @param wallet Wallet to register.
       *
       * @group Wallet
       */
      function registerWallet(wallet) {
          const callback = ({ register }) => register(wallet);
          try {
              window.dispatchEvent(new RegisterWalletEvent(callback));
          }
          catch (error) {
              console.error('wallet-standard:register-wallet event could not be dispatched\n', error);
          }
          try {
              window.addEventListener('wallet-standard:app-ready', ({ detail: api }) => callback(api));
          }
          catch (error) {
              console.error('wallet-standard:app-ready event listener could not be added\n', error);
          }
      }
      class RegisterWalletEvent extends Event {
          get detail() {
              return __classPrivateFieldGet$1(this, _RegisterWalletEvent_detail, "f");
          }
          get type() {
              return 'wallet-standard:register-wallet';
          }
          constructor(callback) {
              super('wallet-standard:register-wallet', {
                  bubbles: false,
                  cancelable: false,
                  composed: false,
              });
              _RegisterWalletEvent_detail.set(this, void 0);
              __classPrivateFieldSet$1(this, _RegisterWalletEvent_detail, callback, "f");
          }
          /** @deprecated */
          preventDefault() {
              throw new Error('preventDefault cannot be called');
          }
          /** @deprecated */
          stopImmediatePropagation() {
              throw new Error('stopImmediatePropagation cannot be called');
          }
          /** @deprecated */
          stopPropagation() {
              throw new Error('stopPropagation cannot be called');
          }
      }
      _RegisterWalletEvent_detail = new WeakMap();
      /**
       * @deprecated Use {@link registerWallet} instead.
       *
       * @group Deprecated
       */
      function DEPRECATED_registerWallet(wallet) {
          var _a;
          registerWallet(wallet);
          try {
              ((_a = window.navigator).wallets || (_a.wallets = [])).push(({ register }) => register(wallet));
          }
          catch (error) {
              console.error('window.navigator.wallets could not be pushed\n', error);
          }
      }

      var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
          if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
          if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
          return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
      };
      var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
          if (kind === "m") throw new TypeError("Private method is not writable");
          if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
          if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
          return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
      };
      var _ReadonlyWalletAccount_address, _ReadonlyWalletAccount_publicKey, _ReadonlyWalletAccount_chains, _ReadonlyWalletAccount_features, _ReadonlyWalletAccount_label, _ReadonlyWalletAccount_icon;
      /**
       * Base implementation of a {@link "@wallet-standard/base".WalletAccount} to be used or extended by a
       * {@link "@wallet-standard/base".Wallet}.
       *
       * `WalletAccount` properties must be read-only. This class enforces this by making all properties
       * [truly private](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields) and
       * read-only, using getters for access, returning copies instead of references, and calling
       * [Object.freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)
       * on the instance.
       *
       * @group Account
       */
      class ReadonlyWalletAccount {
          /** Implementation of {@link "@wallet-standard/base".WalletAccount.address | WalletAccount::address} */
          get address() {
              return __classPrivateFieldGet(this, _ReadonlyWalletAccount_address, "f");
          }
          /** Implementation of {@link "@wallet-standard/base".WalletAccount.publicKey | WalletAccount::publicKey} */
          get publicKey() {
              return __classPrivateFieldGet(this, _ReadonlyWalletAccount_publicKey, "f").slice();
          }
          /** Implementation of {@link "@wallet-standard/base".WalletAccount.chains | WalletAccount::chains} */
          get chains() {
              return __classPrivateFieldGet(this, _ReadonlyWalletAccount_chains, "f").slice();
          }
          /** Implementation of {@link "@wallet-standard/base".WalletAccount.features | WalletAccount::features} */
          get features() {
              return __classPrivateFieldGet(this, _ReadonlyWalletAccount_features, "f").slice();
          }
          /** Implementation of {@link "@wallet-standard/base".WalletAccount.label | WalletAccount::label} */
          get label() {
              return __classPrivateFieldGet(this, _ReadonlyWalletAccount_label, "f");
          }
          /** Implementation of {@link "@wallet-standard/base".WalletAccount.icon | WalletAccount::icon} */
          get icon() {
              return __classPrivateFieldGet(this, _ReadonlyWalletAccount_icon, "f");
          }
          /**
           * Create and freeze a read-only account.
           *
           * @param account Account to copy properties from.
           */
          constructor(account) {
              _ReadonlyWalletAccount_address.set(this, void 0);
              _ReadonlyWalletAccount_publicKey.set(this, void 0);
              _ReadonlyWalletAccount_chains.set(this, void 0);
              _ReadonlyWalletAccount_features.set(this, void 0);
              _ReadonlyWalletAccount_label.set(this, void 0);
              _ReadonlyWalletAccount_icon.set(this, void 0);
              if (new.target === ReadonlyWalletAccount) {
                  Object.freeze(this);
              }
              __classPrivateFieldSet(this, _ReadonlyWalletAccount_address, account.address, "f");
              __classPrivateFieldSet(this, _ReadonlyWalletAccount_publicKey, account.publicKey.slice(), "f");
              __classPrivateFieldSet(this, _ReadonlyWalletAccount_chains, account.chains.slice(), "f");
              __classPrivateFieldSet(this, _ReadonlyWalletAccount_features, account.features.slice(), "f");
              __classPrivateFieldSet(this, _ReadonlyWalletAccount_label, account.label, "f");
              __classPrivateFieldSet(this, _ReadonlyWalletAccount_icon, account.icon, "f");
          }
      } exports("ReadonlyWalletAccount", ReadonlyWalletAccount);
      _ReadonlyWalletAccount_address = new WeakMap(), _ReadonlyWalletAccount_publicKey = new WeakMap(), _ReadonlyWalletAccount_chains = new WeakMap(), _ReadonlyWalletAccount_features = new WeakMap(), _ReadonlyWalletAccount_label = new WeakMap(), _ReadonlyWalletAccount_icon = new WeakMap();
      /**
       * Efficiently compare {@link Indexed} arrays (e.g. `Array` and `Uint8Array`).
       *
       * @param a An array.
       * @param b Another array.
       *
       * @return `true` if the arrays have the same length and elements, `false` otherwise.
       *
       * @group Util
       */
      function arraysEqual(a, b) {
          if (a === b)
              return true;
          const length = a.length;
          if (length !== b.length)
              return false;
          for (let i = 0; i < length; i++) {
              if (a[i] !== b[i])
                  return false;
          }
          return true;
      }
      /**
       * Efficiently compare byte arrays, using {@link arraysEqual}.
       *
       * @param a A byte array.
       * @param b Another byte array.
       *
       * @return `true` if the byte arrays have the same length and bytes, `false` otherwise.
       *
       * @group Util
       */
      function bytesEqual(a, b) {
          return arraysEqual(a, b);
      }
      /**
       * Efficiently concatenate byte arrays without modifying them.
       *
       * @param first  A byte array.
       * @param others Additional byte arrays.
       *
       * @return New byte array containing the concatenation of all the byte arrays.
       *
       * @group Util
       */
      function concatBytes(first, ...others) {
          const length = others.reduce((length, bytes) => length + bytes.length, first.length);
          const bytes = new Uint8Array(length);
          bytes.set(first, 0);
          for (const other of others) {
              bytes.set(other, bytes.length);
          }
          return bytes;
      }
      /**
       * Create a new object with a subset of fields from a source object.
       *
       * @param source Object to pick fields from.
       * @param keys   Names of fields to pick.
       *
       * @return New object with only the picked fields.
       *
       * @group Util
       */
      function pick(source, ...keys) {
          const picked = {};
          for (const key of keys) {
              picked[key] = source[key];
          }
          return picked;
      }
      /**
       * Call a callback function, catch an error if it throws, and log the error without rethrowing.
       *
       * @param callback Function to call.
       *
       * @group Util
       */
      function guard(callback) {
          try {
              callback();
          }
          catch (error) {
              console.error(error);
          }
      }

      async function signAndExecuteTransaction(wallet, input) {
        if (wallet.features["sui:signAndExecuteTransaction"]) {
          return wallet.features["sui:signAndExecuteTransaction"].signAndExecuteTransaction(input);
        }
        if (!wallet.features["sui:signAndExecuteTransactionBlock"]) {
          throw new Error(
            `Provided wallet (${wallet.name}) does not support the signAndExecuteTransaction feature.`
          );
        }
        const { signAndExecuteTransactionBlock } = wallet.features["sui:signAndExecuteTransactionBlock"];
        const transactionBlock = Transaction.from(await input.transaction.toJSON());
        const { digest, rawEffects, rawTransaction } = await signAndExecuteTransactionBlock({
          account: input.account,
          chain: input.chain,
          transactionBlock,
          options: {
            showRawEffects: true,
            showRawInput: true
          }
        });
        const [
          {
            txSignatures: [signature],
            intentMessage: { value: bcsTransaction }
          }
        ] = suiBcs.SenderSignedData.parse(fromBase64(rawTransaction));
        const bytes = suiBcs.TransactionData.serialize(bcsTransaction).toBase64();
        return {
          digest,
          signature,
          bytes,
          effects: toBase64(new Uint8Array(rawEffects))
        };
      }
      async function signTransaction(wallet, input) {
        if (wallet.features["sui:signTransaction"]) {
          return wallet.features["sui:signTransaction"].signTransaction(input);
        }
        if (!wallet.features["sui:signTransactionBlock"]) {
          throw new Error(
            `Provided wallet (${wallet.name}) does not support the signTransaction feature.`
          );
        }
        const { signTransactionBlock } = wallet.features["sui:signTransactionBlock"];
        const transaction = Transaction.from(await input.transaction.toJSON());
        const { transactionBlockBytes, signature } = await signTransactionBlock({
          transactionBlock: transaction,
          account: input.account,
          chain: input.chain
        });
        return { bytes: transactionBlockBytes, signature };
      }

      const SuiSignMessage = exports("SuiSignMessage", "sui:signMessage");

      const SuiSignTransactionBlock = exports("SuiSignTransactionBlock", "sui:signTransactionBlock");

      const SuiSignTransaction = exports("SuiSignTransaction", "sui:signTransaction");

      const SuiSignAndExecuteTransactionBlock = exports("SuiSignAndExecuteTransactionBlock", "sui:signAndExecuteTransactionBlock");

      const SuiSignAndExecuteTransaction = exports("SuiSignAndExecuteTransaction", "sui:signAndExecuteTransaction");

      const SuiSignPersonalMessage = exports("SuiSignPersonalMessage", "sui:signPersonalMessage");

      const SuiReportTransactionEffects = exports("SuiReportTransactionEffects", "sui:reportTransactionEffects");

      const SuiGetCapabilities = exports("SuiGetCapabilities", "sui:getCapabilities");

      const REQUIRED_FEATURES = [StandardConnect, StandardEvents];
      function isWalletWithRequiredFeatureSet(wallet, additionalFeatures = []) {
        return [...REQUIRED_FEATURES, ...additionalFeatures].every(
          (feature) => feature in wallet.features
        );
      }

      const SUI_DEVNET_CHAIN = exports("SUI_DEVNET_CHAIN", "sui:devnet");
      const SUI_TESTNET_CHAIN = exports("SUI_TESTNET_CHAIN", "sui:testnet");
      const SUI_LOCALNET_CHAIN = exports("SUI_LOCALNET_CHAIN", "sui:localnet");
      const SUI_MAINNET_CHAIN = exports("SUI_MAINNET_CHAIN", "sui:mainnet");
      const SUI_CHAINS = exports("SUI_CHAINS", [
        SUI_DEVNET_CHAIN,
        SUI_TESTNET_CHAIN,
        SUI_LOCALNET_CHAIN,
        SUI_MAINNET_CHAIN
      ]);
      function isSuiChain(chain) {
        return SUI_CHAINS.includes(chain);
      }

      /**
       * Sui SDK System.register 打包入口
       * 只导出实际使用的 API，减少体积
       */
      // ===== Buffer polyfill (Node 内建兜底) =====
      if (typeof globalThis.Buffer === 'undefined') {
          globalThis.Buffer = bufferExports.Buffer;
      }
      // ===== 版本信息 =====
      const SDK_VERSION = exports("SDK_VERSION", '1.42.0');
      const BUNDLER_VERSION = exports("BUNDLER_VERSION", '1.0.0');

    })
  };
}));
