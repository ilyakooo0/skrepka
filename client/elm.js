(function(scope){
'use strict';

function F(arity, fun, wrapper) {
  wrapper.a = arity;
  wrapper.f = fun;
  return wrapper;
}

function F2(fun) {
  return F(2, fun, function(a) { return function(b) { return fun(a,b); }; })
}
function F3(fun) {
  return F(3, fun, function(a) {
    return function(b) { return function(c) { return fun(a, b, c); }; };
  });
}
function F4(fun) {
  return F(4, fun, function(a) { return function(b) { return function(c) {
    return function(d) { return fun(a, b, c, d); }; }; };
  });
}
function F5(fun) {
  return F(5, fun, function(a) { return function(b) { return function(c) {
    return function(d) { return function(e) { return fun(a, b, c, d, e); }; }; }; };
  });
}
function F6(fun) {
  return F(6, fun, function(a) { return function(b) { return function(c) {
    return function(d) { return function(e) { return function(f) {
    return fun(a, b, c, d, e, f); }; }; }; }; };
  });
}
function F7(fun) {
  return F(7, fun, function(a) { return function(b) { return function(c) {
    return function(d) { return function(e) { return function(f) {
    return function(g) { return fun(a, b, c, d, e, f, g); }; }; }; }; }; };
  });
}
function F8(fun) {
  return F(8, fun, function(a) { return function(b) { return function(c) {
    return function(d) { return function(e) { return function(f) {
    return function(g) { return function(h) {
    return fun(a, b, c, d, e, f, g, h); }; }; }; }; }; }; };
  });
}
function F9(fun) {
  return F(9, fun, function(a) { return function(b) { return function(c) {
    return function(d) { return function(e) { return function(f) {
    return function(g) { return function(h) { return function(i) {
    return fun(a, b, c, d, e, f, g, h, i); }; }; }; }; }; }; }; };
  });
}

function A2(fun, a, b) {
  return fun.a === 2 ? fun.f(a, b) : fun(a)(b);
}
function A3(fun, a, b, c) {
  return fun.a === 3 ? fun.f(a, b, c) : fun(a)(b)(c);
}
function A4(fun, a, b, c, d) {
  return fun.a === 4 ? fun.f(a, b, c, d) : fun(a)(b)(c)(d);
}
function A5(fun, a, b, c, d, e) {
  return fun.a === 5 ? fun.f(a, b, c, d, e) : fun(a)(b)(c)(d)(e);
}
function A6(fun, a, b, c, d, e, f) {
  return fun.a === 6 ? fun.f(a, b, c, d, e, f) : fun(a)(b)(c)(d)(e)(f);
}
function A7(fun, a, b, c, d, e, f, g) {
  return fun.a === 7 ? fun.f(a, b, c, d, e, f, g) : fun(a)(b)(c)(d)(e)(f)(g);
}
function A8(fun, a, b, c, d, e, f, g, h) {
  return fun.a === 8 ? fun.f(a, b, c, d, e, f, g, h) : fun(a)(b)(c)(d)(e)(f)(g)(h);
}
function A9(fun, a, b, c, d, e, f, g, h, i) {
  return fun.a === 9 ? fun.f(a, b, c, d, e, f, g, h, i) : fun(a)(b)(c)(d)(e)(f)(g)(h)(i);
}

console.warn('Compiled in DEV mode. Follow the advice at https://elm-lang.org/0.19.1/optimize for better performance and smaller assets.');


var _JsArray_empty = [];

function _JsArray_singleton(value)
{
    return [value];
}

function _JsArray_length(array)
{
    return array.length;
}

var _JsArray_initialize = F3(function(size, offset, func)
{
    var result = new Array(size);

    for (var i = 0; i < size; i++)
    {
        result[i] = func(offset + i);
    }

    return result;
});

var _JsArray_initializeFromList = F2(function (max, ls)
{
    var result = new Array(max);

    for (var i = 0; i < max && ls.b; i++)
    {
        result[i] = ls.a;
        ls = ls.b;
    }

    result.length = i;
    return _Utils_Tuple2(result, ls);
});

var _JsArray_unsafeGet = F2(function(index, array)
{
    return array[index];
});

var _JsArray_unsafeSet = F3(function(index, value, array)
{
    var length = array.length;
    var result = new Array(length);

    for (var i = 0; i < length; i++)
    {
        result[i] = array[i];
    }

    result[index] = value;
    return result;
});

var _JsArray_push = F2(function(value, array)
{
    var length = array.length;
    var result = new Array(length + 1);

    for (var i = 0; i < length; i++)
    {
        result[i] = array[i];
    }

    result[length] = value;
    return result;
});

var _JsArray_foldl = F3(function(func, acc, array)
{
    var length = array.length;

    for (var i = 0; i < length; i++)
    {
        acc = A2(func, array[i], acc);
    }

    return acc;
});

var _JsArray_foldr = F3(function(func, acc, array)
{
    for (var i = array.length - 1; i >= 0; i--)
    {
        acc = A2(func, array[i], acc);
    }

    return acc;
});

var _JsArray_map = F2(function(func, array)
{
    var length = array.length;
    var result = new Array(length);

    for (var i = 0; i < length; i++)
    {
        result[i] = func(array[i]);
    }

    return result;
});

var _JsArray_indexedMap = F3(function(func, offset, array)
{
    var length = array.length;
    var result = new Array(length);

    for (var i = 0; i < length; i++)
    {
        result[i] = A2(func, offset + i, array[i]);
    }

    return result;
});

var _JsArray_slice = F3(function(from, to, array)
{
    return array.slice(from, to);
});

var _JsArray_appendN = F3(function(n, dest, source)
{
    var destLen = dest.length;
    var itemsToCopy = n - destLen;

    if (itemsToCopy > source.length)
    {
        itemsToCopy = source.length;
    }

    var size = destLen + itemsToCopy;
    var result = new Array(size);

    for (var i = 0; i < destLen; i++)
    {
        result[i] = dest[i];
    }

    for (var i = 0; i < itemsToCopy; i++)
    {
        result[i + destLen] = source[i];
    }

    return result;
});



// LOG


var _Debug_log = F2(function(tag, value)
{
	console.log(tag + ': ' + _Debug_toString(value));
	return value;
});


// TODOS

function _Debug_todo(moduleName, region)
{
	return function(message) {
		_Debug_crash(8, moduleName, region, message);
	};
}

function _Debug_todoCase(moduleName, region, value)
{
	return function(message) {
		_Debug_crash(9, moduleName, region, value, message);
	};
}


// TO STRING


function _Debug_toString(value)
{
	return _Debug_toAnsiString(false, value);
}

function _Debug_toAnsiString(ansi, value)
{
	if (typeof value === 'function')
	{
		return _Debug_internalColor(ansi, '<function>');
	}

	if (typeof value === 'boolean')
	{
		return _Debug_ctorColor(ansi, value ? 'True' : 'False');
	}

	if (typeof value === 'number')
	{
		return _Debug_numberColor(ansi, value + '');
	}

	if (value instanceof String)
	{
		return _Debug_charColor(ansi, "'" + _Debug_addSlashes(value, true) + "'");
	}

	if (typeof value === 'string')
	{
		return _Debug_stringColor(ansi, '"' + _Debug_addSlashes(value, false) + '"');
	}

	if (typeof value === 'object' && '$' in value)
	{
		var tag = value.$;

		if (typeof tag === 'number')
		{
			return _Debug_internalColor(ansi, '<internals>');
		}

		if (tag[0] === '#')
		{
			var output = [];
			for (var k in value)
			{
				if (k === '$') continue;
				output.push(_Debug_toAnsiString(ansi, value[k]));
			}
			return '(' + output.join(',') + ')';
		}

		if (tag === 'Set_elm_builtin')
		{
			return _Debug_ctorColor(ansi, 'Set')
				+ _Debug_fadeColor(ansi, '.fromList') + ' '
				+ _Debug_toAnsiString(ansi, $elm$core$Set$toList(value));
		}

		if (tag === 'RBNode_elm_builtin' || tag === 'RBEmpty_elm_builtin')
		{
			return _Debug_ctorColor(ansi, 'Dict')
				+ _Debug_fadeColor(ansi, '.fromList') + ' '
				+ _Debug_toAnsiString(ansi, $elm$core$Dict$toList(value));
		}

		if (tag === 'Array_elm_builtin')
		{
			return _Debug_ctorColor(ansi, 'Array')
				+ _Debug_fadeColor(ansi, '.fromList') + ' '
				+ _Debug_toAnsiString(ansi, $elm$core$Array$toList(value));
		}

		if (tag === '::' || tag === '[]')
		{
			var output = '[';

			value.b && (output += _Debug_toAnsiString(ansi, value.a), value = value.b)

			for (; value.b; value = value.b) // WHILE_CONS
			{
				output += ',' + _Debug_toAnsiString(ansi, value.a);
			}
			return output + ']';
		}

		var output = '';
		for (var i in value)
		{
			if (i === '$') continue;
			var str = _Debug_toAnsiString(ansi, value[i]);
			var c0 = str[0];
			var parenless = c0 === '{' || c0 === '(' || c0 === '[' || c0 === '<' || c0 === '"' || str.indexOf(' ') < 0;
			output += ' ' + (parenless ? str : '(' + str + ')');
		}
		return _Debug_ctorColor(ansi, tag) + output;
	}

	if (typeof DataView === 'function' && value instanceof DataView)
	{
		return _Debug_stringColor(ansi, '<' + value.byteLength + ' bytes>');
	}

	if (typeof File !== 'undefined' && value instanceof File)
	{
		return _Debug_internalColor(ansi, '<' + value.name + '>');
	}

	if (typeof value === 'object')
	{
		var output = [];
		for (var key in value)
		{
			var field = key[0] === '_' ? key.slice(1) : key;
			output.push(_Debug_fadeColor(ansi, field) + ' = ' + _Debug_toAnsiString(ansi, value[key]));
		}
		if (output.length === 0)
		{
			return '{}';
		}
		return '{ ' + output.join(', ') + ' }';
	}

	return _Debug_internalColor(ansi, '<internals>');
}

function _Debug_addSlashes(str, isChar)
{
	var s = str
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/\t/g, '\\t')
		.replace(/\r/g, '\\r')
		.replace(/\v/g, '\\v')
		.replace(/\0/g, '\\0');

	if (isChar)
	{
		return s.replace(/\'/g, '\\\'');
	}
	else
	{
		return s.replace(/\"/g, '\\"');
	}
}

function _Debug_ctorColor(ansi, string)
{
	return ansi ? '\x1b[96m' + string + '\x1b[0m' : string;
}

function _Debug_numberColor(ansi, string)
{
	return ansi ? '\x1b[95m' + string + '\x1b[0m' : string;
}

function _Debug_stringColor(ansi, string)
{
	return ansi ? '\x1b[93m' + string + '\x1b[0m' : string;
}

function _Debug_charColor(ansi, string)
{
	return ansi ? '\x1b[92m' + string + '\x1b[0m' : string;
}

function _Debug_fadeColor(ansi, string)
{
	return ansi ? '\x1b[37m' + string + '\x1b[0m' : string;
}

function _Debug_internalColor(ansi, string)
{
	return ansi ? '\x1b[36m' + string + '\x1b[0m' : string;
}

function _Debug_toHexDigit(n)
{
	return String.fromCharCode(n < 10 ? 48 + n : 55 + n);
}


// CRASH




function _Debug_crash(identifier, fact1, fact2, fact3, fact4)
{
	switch(identifier)
	{
		case 0:
			throw new Error('What node should I take over? In JavaScript I need something like:\n\n    Elm.Main.init({\n        node: document.getElementById("elm-node")\n    })\n\nYou need to do this with any Browser.sandbox or Browser.element program.');

		case 1:
			throw new Error('Browser.application programs cannot handle URLs like this:\n\n    ' + document.location.href + '\n\nWhat is the root? The root of your file system? Try looking at this program with `elm reactor` or some other server.');

		case 2:
			var jsonErrorString = fact1;
			throw new Error('Problem with the flags given to your Elm program on initialization.\n\n' + jsonErrorString);

		case 3:
			var portName = fact1;
			throw new Error('There can only be one port named `' + portName + '`, but your program has multiple.');

		case 4:
			var portName = fact1;
			var problem = fact2;
			throw new Error('Trying to send an unexpected type of value through port `' + portName + '`:\n' + problem);

		case 5:
			throw new Error('Trying to use `(==)` on functions.\nThere is no way to know if functions are "the same" in the Elm sense.\nRead more about this at https://package.elm-lang.org/packages/elm/core/latest/Basics#== which describes why it is this way and what the better version will look like.');

		case 6:
			var moduleName = fact1;
			throw new Error('Your page is loading multiple Elm scripts with a module named ' + moduleName + '. Maybe a duplicate script is getting loaded accidentally? If not, rename one of them so I know which is which!');

		case 8:
			var moduleName = fact1;
			var region = fact2;
			var message = fact3;
			throw new Error('TODO in module `' + moduleName + '` ' + _Debug_regionToString(region) + '\n\n' + message);

		case 9:
			var moduleName = fact1;
			var region = fact2;
			var value = fact3;
			var message = fact4;
			throw new Error(
				'TODO in module `' + moduleName + '` from the `case` expression '
				+ _Debug_regionToString(region) + '\n\nIt received the following value:\n\n    '
				+ _Debug_toString(value).replace('\n', '\n    ')
				+ '\n\nBut the branch that handles it says:\n\n    ' + message.replace('\n', '\n    ')
			);

		case 10:
			throw new Error('Bug in https://github.com/elm/virtual-dom/issues');

		case 11:
			throw new Error('Cannot perform mod 0. Division by zero error.');
	}
}

function _Debug_regionToString(region)
{
	if (region.start.line === region.end.line)
	{
		return 'on line ' + region.start.line;
	}
	return 'on lines ' + region.start.line + ' through ' + region.end.line;
}



// EQUALITY

function _Utils_eq(x, y)
{
	for (
		var pair, stack = [], isEqual = _Utils_eqHelp(x, y, 0, stack);
		isEqual && (pair = stack.pop());
		isEqual = _Utils_eqHelp(pair.a, pair.b, 0, stack)
		)
	{}

	return isEqual;
}

function _Utils_eqHelp(x, y, depth, stack)
{
	if (x === y)
	{
		return true;
	}

	if (typeof x !== 'object' || x === null || y === null)
	{
		typeof x === 'function' && _Debug_crash(5);
		return false;
	}

	if (depth > 100)
	{
		stack.push(_Utils_Tuple2(x,y));
		return true;
	}

	/**/
	if (x.$ === 'Set_elm_builtin')
	{
		x = $elm$core$Set$toList(x);
		y = $elm$core$Set$toList(y);
	}
	if (x.$ === 'RBNode_elm_builtin' || x.$ === 'RBEmpty_elm_builtin')
	{
		x = $elm$core$Dict$toList(x);
		y = $elm$core$Dict$toList(y);
	}
	//*/

	/**_UNUSED/
	if (x.$ < 0)
	{
		x = $elm$core$Dict$toList(x);
		y = $elm$core$Dict$toList(y);
	}
	//*/

	for (var key in x)
	{
		if (!_Utils_eqHelp(x[key], y[key], depth + 1, stack))
		{
			return false;
		}
	}
	return true;
}

var _Utils_equal = F2(_Utils_eq);
var _Utils_notEqual = F2(function(a, b) { return !_Utils_eq(a,b); });



// COMPARISONS

// Code in Generate/JavaScript.hs, Basics.js, and List.js depends on
// the particular integer values assigned to LT, EQ, and GT.

function _Utils_cmp(x, y, ord)
{
	if (typeof x !== 'object')
	{
		return x === y ? /*EQ*/ 0 : x < y ? /*LT*/ -1 : /*GT*/ 1;
	}

	/**/
	if (x instanceof String)
	{
		var a = x.valueOf();
		var b = y.valueOf();
		return a === b ? 0 : a < b ? -1 : 1;
	}
	//*/

	/**_UNUSED/
	if (typeof x.$ === 'undefined')
	//*/
	/**/
	if (x.$[0] === '#')
	//*/
	{
		return (ord = _Utils_cmp(x.a, y.a))
			? ord
			: (ord = _Utils_cmp(x.b, y.b))
				? ord
				: _Utils_cmp(x.c, y.c);
	}

	// traverse conses until end of a list or a mismatch
	for (; x.b && y.b && !(ord = _Utils_cmp(x.a, y.a)); x = x.b, y = y.b) {} // WHILE_CONSES
	return ord || (x.b ? /*GT*/ 1 : y.b ? /*LT*/ -1 : /*EQ*/ 0);
}

var _Utils_lt = F2(function(a, b) { return _Utils_cmp(a, b) < 0; });
var _Utils_le = F2(function(a, b) { return _Utils_cmp(a, b) < 1; });
var _Utils_gt = F2(function(a, b) { return _Utils_cmp(a, b) > 0; });
var _Utils_ge = F2(function(a, b) { return _Utils_cmp(a, b) >= 0; });

var _Utils_compare = F2(function(x, y)
{
	var n = _Utils_cmp(x, y);
	return n < 0 ? $elm$core$Basics$LT : n ? $elm$core$Basics$GT : $elm$core$Basics$EQ;
});


// COMMON VALUES

var _Utils_Tuple0 = { $: '#0' };

function _Utils_Tuple2(a, b) { return { $: '#2', a: a, b: b }; }

function _Utils_Tuple3(a, b, c) { return { $: '#3', a: a, b: b, c: c }; }

function _Utils_chr(c) { return new String(c); }


// RECORDS

function _Utils_update(oldRecord, updatedFields)
{
	var newRecord = {};

	for (var key in oldRecord)
	{
		newRecord[key] = oldRecord[key];
	}

	for (var key in updatedFields)
	{
		newRecord[key] = updatedFields[key];
	}

	return newRecord;
}


// APPEND

var _Utils_append = F2(_Utils_ap);

function _Utils_ap(xs, ys)
{
	// append Strings
	if (typeof xs === 'string')
	{
		return xs + ys;
	}

	// append Lists
	if (!xs.b)
	{
		return ys;
	}
	var root = _List_Cons(xs.a, ys);
	xs = xs.b
	for (var curr = root; xs.b; xs = xs.b) // WHILE_CONS
	{
		curr = curr.b = _List_Cons(xs.a, ys);
	}
	return root;
}



var _List_Nil = { $: '[]' };

function _List_Cons(hd, tl) { return { $: '::', a: hd, b: tl }; }


var _List_cons = F2(_List_Cons);

function _List_fromArray(arr)
{
	var out = _List_Nil;
	for (var i = arr.length; i--; )
	{
		out = _List_Cons(arr[i], out);
	}
	return out;
}

function _List_toArray(xs)
{
	for (var out = []; xs.b; xs = xs.b) // WHILE_CONS
	{
		out.push(xs.a);
	}
	return out;
}

var _List_map2 = F3(function(f, xs, ys)
{
	for (var arr = []; xs.b && ys.b; xs = xs.b, ys = ys.b) // WHILE_CONSES
	{
		arr.push(A2(f, xs.a, ys.a));
	}
	return _List_fromArray(arr);
});

var _List_map3 = F4(function(f, xs, ys, zs)
{
	for (var arr = []; xs.b && ys.b && zs.b; xs = xs.b, ys = ys.b, zs = zs.b) // WHILE_CONSES
	{
		arr.push(A3(f, xs.a, ys.a, zs.a));
	}
	return _List_fromArray(arr);
});

var _List_map4 = F5(function(f, ws, xs, ys, zs)
{
	for (var arr = []; ws.b && xs.b && ys.b && zs.b; ws = ws.b, xs = xs.b, ys = ys.b, zs = zs.b) // WHILE_CONSES
	{
		arr.push(A4(f, ws.a, xs.a, ys.a, zs.a));
	}
	return _List_fromArray(arr);
});

var _List_map5 = F6(function(f, vs, ws, xs, ys, zs)
{
	for (var arr = []; vs.b && ws.b && xs.b && ys.b && zs.b; vs = vs.b, ws = ws.b, xs = xs.b, ys = ys.b, zs = zs.b) // WHILE_CONSES
	{
		arr.push(A5(f, vs.a, ws.a, xs.a, ys.a, zs.a));
	}
	return _List_fromArray(arr);
});

var _List_sortBy = F2(function(f, xs)
{
	return _List_fromArray(_List_toArray(xs).sort(function(a, b) {
		return _Utils_cmp(f(a), f(b));
	}));
});

var _List_sortWith = F2(function(f, xs)
{
	return _List_fromArray(_List_toArray(xs).sort(function(a, b) {
		var ord = A2(f, a, b);
		return ord === $elm$core$Basics$EQ ? 0 : ord === $elm$core$Basics$LT ? -1 : 1;
	}));
});



// MATH

var _Basics_add = F2(function(a, b) { return a + b; });
var _Basics_sub = F2(function(a, b) { return a - b; });
var _Basics_mul = F2(function(a, b) { return a * b; });
var _Basics_fdiv = F2(function(a, b) { return a / b; });
var _Basics_idiv = F2(function(a, b) { return (a / b) | 0; });
var _Basics_pow = F2(Math.pow);

var _Basics_remainderBy = F2(function(b, a) { return a % b; });

// https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/divmodnote-letter.pdf
var _Basics_modBy = F2(function(modulus, x)
{
	var answer = x % modulus;
	return modulus === 0
		? _Debug_crash(11)
		:
	((answer > 0 && modulus < 0) || (answer < 0 && modulus > 0))
		? answer + modulus
		: answer;
});


// TRIGONOMETRY

var _Basics_pi = Math.PI;
var _Basics_e = Math.E;
var _Basics_cos = Math.cos;
var _Basics_sin = Math.sin;
var _Basics_tan = Math.tan;
var _Basics_acos = Math.acos;
var _Basics_asin = Math.asin;
var _Basics_atan = Math.atan;
var _Basics_atan2 = F2(Math.atan2);


// MORE MATH

function _Basics_toFloat(x) { return x; }
function _Basics_truncate(n) { return n | 0; }
function _Basics_isInfinite(n) { return n === Infinity || n === -Infinity; }

var _Basics_ceiling = Math.ceil;
var _Basics_floor = Math.floor;
var _Basics_round = Math.round;
var _Basics_sqrt = Math.sqrt;
var _Basics_log = Math.log;
var _Basics_isNaN = isNaN;


// BOOLEANS

function _Basics_not(bool) { return !bool; }
var _Basics_and = F2(function(a, b) { return a && b; });
var _Basics_or  = F2(function(a, b) { return a || b; });
var _Basics_xor = F2(function(a, b) { return a !== b; });



var _String_cons = F2(function(chr, str)
{
	return chr + str;
});

function _String_uncons(string)
{
	var word = string.charCodeAt(0);
	return !isNaN(word)
		? $elm$core$Maybe$Just(
			0xD800 <= word && word <= 0xDBFF
				? _Utils_Tuple2(_Utils_chr(string[0] + string[1]), string.slice(2))
				: _Utils_Tuple2(_Utils_chr(string[0]), string.slice(1))
		)
		: $elm$core$Maybe$Nothing;
}

var _String_append = F2(function(a, b)
{
	return a + b;
});

function _String_length(str)
{
	return str.length;
}

var _String_map = F2(function(func, string)
{
	var len = string.length;
	var array = new Array(len);
	var i = 0;
	while (i < len)
	{
		var word = string.charCodeAt(i);
		if (0xD800 <= word && word <= 0xDBFF)
		{
			array[i] = func(_Utils_chr(string[i] + string[i+1]));
			i += 2;
			continue;
		}
		array[i] = func(_Utils_chr(string[i]));
		i++;
	}
	return array.join('');
});

var _String_filter = F2(function(isGood, str)
{
	var arr = [];
	var len = str.length;
	var i = 0;
	while (i < len)
	{
		var char = str[i];
		var word = str.charCodeAt(i);
		i++;
		if (0xD800 <= word && word <= 0xDBFF)
		{
			char += str[i];
			i++;
		}

		if (isGood(_Utils_chr(char)))
		{
			arr.push(char);
		}
	}
	return arr.join('');
});

function _String_reverse(str)
{
	var len = str.length;
	var arr = new Array(len);
	var i = 0;
	while (i < len)
	{
		var word = str.charCodeAt(i);
		if (0xD800 <= word && word <= 0xDBFF)
		{
			arr[len - i] = str[i + 1];
			i++;
			arr[len - i] = str[i - 1];
			i++;
		}
		else
		{
			arr[len - i] = str[i];
			i++;
		}
	}
	return arr.join('');
}

var _String_foldl = F3(function(func, state, string)
{
	var len = string.length;
	var i = 0;
	while (i < len)
	{
		var char = string[i];
		var word = string.charCodeAt(i);
		i++;
		if (0xD800 <= word && word <= 0xDBFF)
		{
			char += string[i];
			i++;
		}
		state = A2(func, _Utils_chr(char), state);
	}
	return state;
});

var _String_foldr = F3(function(func, state, string)
{
	var i = string.length;
	while (i--)
	{
		var char = string[i];
		var word = string.charCodeAt(i);
		if (0xDC00 <= word && word <= 0xDFFF)
		{
			i--;
			char = string[i] + char;
		}
		state = A2(func, _Utils_chr(char), state);
	}
	return state;
});

var _String_split = F2(function(sep, str)
{
	return str.split(sep);
});

var _String_join = F2(function(sep, strs)
{
	return strs.join(sep);
});

var _String_slice = F3(function(start, end, str) {
	return str.slice(start, end);
});

function _String_trim(str)
{
	return str.trim();
}

function _String_trimLeft(str)
{
	return str.replace(/^\s+/, '');
}

function _String_trimRight(str)
{
	return str.replace(/\s+$/, '');
}

function _String_words(str)
{
	return _List_fromArray(str.trim().split(/\s+/g));
}

function _String_lines(str)
{
	return _List_fromArray(str.split(/\r\n|\r|\n/g));
}

function _String_toUpper(str)
{
	return str.toUpperCase();
}

function _String_toLower(str)
{
	return str.toLowerCase();
}

var _String_any = F2(function(isGood, string)
{
	var i = string.length;
	while (i--)
	{
		var char = string[i];
		var word = string.charCodeAt(i);
		if (0xDC00 <= word && word <= 0xDFFF)
		{
			i--;
			char = string[i] + char;
		}
		if (isGood(_Utils_chr(char)))
		{
			return true;
		}
	}
	return false;
});

var _String_all = F2(function(isGood, string)
{
	var i = string.length;
	while (i--)
	{
		var char = string[i];
		var word = string.charCodeAt(i);
		if (0xDC00 <= word && word <= 0xDFFF)
		{
			i--;
			char = string[i] + char;
		}
		if (!isGood(_Utils_chr(char)))
		{
			return false;
		}
	}
	return true;
});

var _String_contains = F2(function(sub, str)
{
	return str.indexOf(sub) > -1;
});

var _String_startsWith = F2(function(sub, str)
{
	return str.indexOf(sub) === 0;
});

var _String_endsWith = F2(function(sub, str)
{
	return str.length >= sub.length &&
		str.lastIndexOf(sub) === str.length - sub.length;
});

var _String_indexes = F2(function(sub, str)
{
	var subLen = sub.length;

	if (subLen < 1)
	{
		return _List_Nil;
	}

	var i = 0;
	var is = [];

	while ((i = str.indexOf(sub, i)) > -1)
	{
		is.push(i);
		i = i + subLen;
	}

	return _List_fromArray(is);
});


// TO STRING

function _String_fromNumber(number)
{
	return number + '';
}


// INT CONVERSIONS

function _String_toInt(str)
{
	var total = 0;
	var code0 = str.charCodeAt(0);
	var start = code0 == 0x2B /* + */ || code0 == 0x2D /* - */ ? 1 : 0;

	for (var i = start; i < str.length; ++i)
	{
		var code = str.charCodeAt(i);
		if (code < 0x30 || 0x39 < code)
		{
			return $elm$core$Maybe$Nothing;
		}
		total = 10 * total + code - 0x30;
	}

	return i == start
		? $elm$core$Maybe$Nothing
		: $elm$core$Maybe$Just(code0 == 0x2D ? -total : total);
}


// FLOAT CONVERSIONS

function _String_toFloat(s)
{
	// check if it is a hex, octal, or binary number
	if (s.length === 0 || /[\sxbo]/.test(s))
	{
		return $elm$core$Maybe$Nothing;
	}
	var n = +s;
	// faster isNaN check
	return n === n ? $elm$core$Maybe$Just(n) : $elm$core$Maybe$Nothing;
}

function _String_fromList(chars)
{
	return _List_toArray(chars).join('');
}




function _Char_toCode(char)
{
	var code = char.charCodeAt(0);
	if (0xD800 <= code && code <= 0xDBFF)
	{
		return (code - 0xD800) * 0x400 + char.charCodeAt(1) - 0xDC00 + 0x10000
	}
	return code;
}

function _Char_fromCode(code)
{
	return _Utils_chr(
		(code < 0 || 0x10FFFF < code)
			? '\uFFFD'
			:
		(code <= 0xFFFF)
			? String.fromCharCode(code)
			:
		(code -= 0x10000,
			String.fromCharCode(Math.floor(code / 0x400) + 0xD800, code % 0x400 + 0xDC00)
		)
	);
}

function _Char_toUpper(char)
{
	return _Utils_chr(char.toUpperCase());
}

function _Char_toLower(char)
{
	return _Utils_chr(char.toLowerCase());
}

function _Char_toLocaleUpper(char)
{
	return _Utils_chr(char.toLocaleUpperCase());
}

function _Char_toLocaleLower(char)
{
	return _Utils_chr(char.toLocaleLowerCase());
}



/**/
function _Json_errorToString(error)
{
	return $elm$json$Json$Decode$errorToString(error);
}
//*/


// CORE DECODERS

function _Json_succeed(msg)
{
	return {
		$: 0,
		a: msg
	};
}

function _Json_fail(msg)
{
	return {
		$: 1,
		a: msg
	};
}

function _Json_decodePrim(decoder)
{
	return { $: 2, b: decoder };
}

var _Json_decodeInt = _Json_decodePrim(function(value) {
	return (typeof value !== 'number')
		? _Json_expecting('an INT', value)
		:
	(-2147483647 < value && value < 2147483647 && (value | 0) === value)
		? $elm$core$Result$Ok(value)
		:
	(isFinite(value) && !(value % 1))
		? $elm$core$Result$Ok(value)
		: _Json_expecting('an INT', value);
});

var _Json_decodeBool = _Json_decodePrim(function(value) {
	return (typeof value === 'boolean')
		? $elm$core$Result$Ok(value)
		: _Json_expecting('a BOOL', value);
});

var _Json_decodeFloat = _Json_decodePrim(function(value) {
	return (typeof value === 'number')
		? $elm$core$Result$Ok(value)
		: _Json_expecting('a FLOAT', value);
});

var _Json_decodeValue = _Json_decodePrim(function(value) {
	return $elm$core$Result$Ok(_Json_wrap(value));
});

var _Json_decodeString = _Json_decodePrim(function(value) {
	return (typeof value === 'string')
		? $elm$core$Result$Ok(value)
		: (value instanceof String)
			? $elm$core$Result$Ok(value + '')
			: _Json_expecting('a STRING', value);
});

function _Json_decodeList(decoder) { return { $: 3, b: decoder }; }
function _Json_decodeArray(decoder) { return { $: 4, b: decoder }; }

function _Json_decodeNull(value) { return { $: 5, c: value }; }

var _Json_decodeField = F2(function(field, decoder)
{
	return {
		$: 6,
		d: field,
		b: decoder
	};
});

var _Json_decodeIndex = F2(function(index, decoder)
{
	return {
		$: 7,
		e: index,
		b: decoder
	};
});

function _Json_decodeKeyValuePairs(decoder)
{
	return {
		$: 8,
		b: decoder
	};
}

function _Json_mapMany(f, decoders)
{
	return {
		$: 9,
		f: f,
		g: decoders
	};
}

var _Json_andThen = F2(function(callback, decoder)
{
	return {
		$: 10,
		b: decoder,
		h: callback
	};
});

function _Json_oneOf(decoders)
{
	return {
		$: 11,
		g: decoders
	};
}


// DECODING OBJECTS

var _Json_map1 = F2(function(f, d1)
{
	return _Json_mapMany(f, [d1]);
});

var _Json_map2 = F3(function(f, d1, d2)
{
	return _Json_mapMany(f, [d1, d2]);
});

var _Json_map3 = F4(function(f, d1, d2, d3)
{
	return _Json_mapMany(f, [d1, d2, d3]);
});

var _Json_map4 = F5(function(f, d1, d2, d3, d4)
{
	return _Json_mapMany(f, [d1, d2, d3, d4]);
});

var _Json_map5 = F6(function(f, d1, d2, d3, d4, d5)
{
	return _Json_mapMany(f, [d1, d2, d3, d4, d5]);
});

var _Json_map6 = F7(function(f, d1, d2, d3, d4, d5, d6)
{
	return _Json_mapMany(f, [d1, d2, d3, d4, d5, d6]);
});

var _Json_map7 = F8(function(f, d1, d2, d3, d4, d5, d6, d7)
{
	return _Json_mapMany(f, [d1, d2, d3, d4, d5, d6, d7]);
});

var _Json_map8 = F9(function(f, d1, d2, d3, d4, d5, d6, d7, d8)
{
	return _Json_mapMany(f, [d1, d2, d3, d4, d5, d6, d7, d8]);
});


// DECODE

var _Json_runOnString = F2(function(decoder, string)
{
	try
	{
		var value = JSON.parse(string);
		return _Json_runHelp(decoder, value);
	}
	catch (e)
	{
		return $elm$core$Result$Err(A2($elm$json$Json$Decode$Failure, 'This is not valid JSON! ' + e.message, _Json_wrap(string)));
	}
});

var _Json_run = F2(function(decoder, value)
{
	return _Json_runHelp(decoder, _Json_unwrap(value));
});

function _Json_runHelp(decoder, value)
{
	switch (decoder.$)
	{
		case 2:
			return decoder.b(value);

		case 5:
			return (value === null)
				? $elm$core$Result$Ok(decoder.c)
				: _Json_expecting('null', value);

		case 3:
			if (!_Json_isArray(value))
			{
				return _Json_expecting('a LIST', value);
			}
			return _Json_runArrayDecoder(decoder.b, value, _List_fromArray);

		case 4:
			if (!_Json_isArray(value))
			{
				return _Json_expecting('an ARRAY', value);
			}
			return _Json_runArrayDecoder(decoder.b, value, _Json_toElmArray);

		case 6:
			var field = decoder.d;
			if (typeof value !== 'object' || value === null || !(field in value))
			{
				return _Json_expecting('an OBJECT with a field named `' + field + '`', value);
			}
			var result = _Json_runHelp(decoder.b, value[field]);
			return ($elm$core$Result$isOk(result)) ? result : $elm$core$Result$Err(A2($elm$json$Json$Decode$Field, field, result.a));

		case 7:
			var index = decoder.e;
			if (!_Json_isArray(value))
			{
				return _Json_expecting('an ARRAY', value);
			}
			if (index >= value.length)
			{
				return _Json_expecting('a LONGER array. Need index ' + index + ' but only see ' + value.length + ' entries', value);
			}
			var result = _Json_runHelp(decoder.b, value[index]);
			return ($elm$core$Result$isOk(result)) ? result : $elm$core$Result$Err(A2($elm$json$Json$Decode$Index, index, result.a));

		case 8:
			if (typeof value !== 'object' || value === null || _Json_isArray(value))
			{
				return _Json_expecting('an OBJECT', value);
			}

			var keyValuePairs = _List_Nil;
			// TODO test perf of Object.keys and switch when support is good enough
			for (var key in value)
			{
				if (Object.prototype.hasOwnProperty.call(value, key))
				{
					var result = _Json_runHelp(decoder.b, value[key]);
					if (!$elm$core$Result$isOk(result))
					{
						return $elm$core$Result$Err(A2($elm$json$Json$Decode$Field, key, result.a));
					}
					keyValuePairs = _List_Cons(_Utils_Tuple2(key, result.a), keyValuePairs);
				}
			}
			return $elm$core$Result$Ok($elm$core$List$reverse(keyValuePairs));

		case 9:
			var answer = decoder.f;
			var decoders = decoder.g;
			for (var i = 0; i < decoders.length; i++)
			{
				var result = _Json_runHelp(decoders[i], value);
				if (!$elm$core$Result$isOk(result))
				{
					return result;
				}
				answer = answer(result.a);
			}
			return $elm$core$Result$Ok(answer);

		case 10:
			var result = _Json_runHelp(decoder.b, value);
			return (!$elm$core$Result$isOk(result))
				? result
				: _Json_runHelp(decoder.h(result.a), value);

		case 11:
			var errors = _List_Nil;
			for (var temp = decoder.g; temp.b; temp = temp.b) // WHILE_CONS
			{
				var result = _Json_runHelp(temp.a, value);
				if ($elm$core$Result$isOk(result))
				{
					return result;
				}
				errors = _List_Cons(result.a, errors);
			}
			return $elm$core$Result$Err($elm$json$Json$Decode$OneOf($elm$core$List$reverse(errors)));

		case 1:
			return $elm$core$Result$Err(A2($elm$json$Json$Decode$Failure, decoder.a, _Json_wrap(value)));

		case 0:
			return $elm$core$Result$Ok(decoder.a);
	}
}

function _Json_runArrayDecoder(decoder, value, toElmValue)
{
	var len = value.length;
	var array = new Array(len);
	for (var i = 0; i < len; i++)
	{
		var result = _Json_runHelp(decoder, value[i]);
		if (!$elm$core$Result$isOk(result))
		{
			return $elm$core$Result$Err(A2($elm$json$Json$Decode$Index, i, result.a));
		}
		array[i] = result.a;
	}
	return $elm$core$Result$Ok(toElmValue(array));
}

function _Json_isArray(value)
{
	return Array.isArray(value) || (typeof FileList !== 'undefined' && value instanceof FileList);
}

function _Json_toElmArray(array)
{
	return A2($elm$core$Array$initialize, array.length, function(i) { return array[i]; });
}

function _Json_expecting(type, value)
{
	return $elm$core$Result$Err(A2($elm$json$Json$Decode$Failure, 'Expecting ' + type, _Json_wrap(value)));
}


// EQUALITY

function _Json_equality(x, y)
{
	if (x === y)
	{
		return true;
	}

	if (x.$ !== y.$)
	{
		return false;
	}

	switch (x.$)
	{
		case 0:
		case 1:
			return x.a === y.a;

		case 2:
			return x.b === y.b;

		case 5:
			return x.c === y.c;

		case 3:
		case 4:
		case 8:
			return _Json_equality(x.b, y.b);

		case 6:
			return x.d === y.d && _Json_equality(x.b, y.b);

		case 7:
			return x.e === y.e && _Json_equality(x.b, y.b);

		case 9:
			return x.f === y.f && _Json_listEquality(x.g, y.g);

		case 10:
			return x.h === y.h && _Json_equality(x.b, y.b);

		case 11:
			return _Json_listEquality(x.g, y.g);
	}
}

function _Json_listEquality(aDecoders, bDecoders)
{
	var len = aDecoders.length;
	if (len !== bDecoders.length)
	{
		return false;
	}
	for (var i = 0; i < len; i++)
	{
		if (!_Json_equality(aDecoders[i], bDecoders[i]))
		{
			return false;
		}
	}
	return true;
}


// ENCODE

var _Json_encode = F2(function(indentLevel, value)
{
	return JSON.stringify(_Json_unwrap(value), null, indentLevel) + '';
});

function _Json_wrap(value) { return { $: 0, a: value }; }
function _Json_unwrap(value) { return value.a; }


function _Json_emptyArray() { return []; }
function _Json_emptyObject() { return {}; }

var _Json_addField = F3(function(key, value, object)
{
	var unwrapped = _Json_unwrap(value);
	if (!(key === 'toJSON' && typeof unwrapped === 'function'))
	{
		object[key] = unwrapped;
	}
	return object;
});

function _Json_addEntry(func)
{
	return F2(function(entry, array)
	{
		array.push(_Json_unwrap(func(entry)));
		return array;
	});
}

var _Json_encodeNull = _Json_wrap(null);



// TASKS

function _Scheduler_succeed(value)
{
	return {
		$: 0,
		a: value
	};
}

function _Scheduler_fail(error)
{
	return {
		$: 1,
		a: error
	};
}

function _Scheduler_binding(callback)
{
	return {
		$: 2,
		b: callback,
		c: null
	};
}

var _Scheduler_andThen = F2(function(callback, task)
{
	return {
		$: 3,
		b: callback,
		d: task
	};
});

var _Scheduler_onError = F2(function(callback, task)
{
	return {
		$: 4,
		b: callback,
		d: task
	};
});

function _Scheduler_receive(callback)
{
	return {
		$: 5,
		b: callback
	};
}


// PROCESSES

var _Scheduler_guid = 0;

function _Scheduler_rawSpawn(task)
{
	var proc = {
		$: 0,
		e: _Scheduler_guid++,
		f: task,
		g: null,
		h: []
	};

	_Scheduler_enqueue(proc);

	return proc;
}

function _Scheduler_spawn(task)
{
	return _Scheduler_binding(function(callback) {
		callback(_Scheduler_succeed(_Scheduler_rawSpawn(task)));
	});
}

function _Scheduler_rawSend(proc, msg)
{
	proc.h.push(msg);
	_Scheduler_enqueue(proc);
}

var _Scheduler_send = F2(function(proc, msg)
{
	return _Scheduler_binding(function(callback) {
		_Scheduler_rawSend(proc, msg);
		callback(_Scheduler_succeed(_Utils_Tuple0));
	});
});

function _Scheduler_kill(proc)
{
	return _Scheduler_binding(function(callback) {
		var task = proc.f;
		if (task.$ === 2 && task.c)
		{
			task.c();
		}

		proc.f = null;

		callback(_Scheduler_succeed(_Utils_Tuple0));
	});
}


/* STEP PROCESSES

type alias Process =
  { $ : tag
  , id : unique_id
  , root : Task
  , stack : null | { $: SUCCEED | FAIL, a: callback, b: stack }
  , mailbox : [msg]
  }

*/


var _Scheduler_working = false;
var _Scheduler_queue = [];


function _Scheduler_enqueue(proc)
{
	_Scheduler_queue.push(proc);
	if (_Scheduler_working)
	{
		return;
	}
	_Scheduler_working = true;
	while (proc = _Scheduler_queue.shift())
	{
		_Scheduler_step(proc);
	}
	_Scheduler_working = false;
}


function _Scheduler_step(proc)
{
	while (proc.f)
	{
		var rootTag = proc.f.$;
		if (rootTag === 0 || rootTag === 1)
		{
			while (proc.g && proc.g.$ !== rootTag)
			{
				proc.g = proc.g.i;
			}
			if (!proc.g)
			{
				return;
			}
			proc.f = proc.g.b(proc.f.a);
			proc.g = proc.g.i;
		}
		else if (rootTag === 2)
		{
			proc.f.c = proc.f.b(function(newRoot) {
				proc.f = newRoot;
				_Scheduler_enqueue(proc);
			});
			return;
		}
		else if (rootTag === 5)
		{
			if (proc.h.length === 0)
			{
				return;
			}
			proc.f = proc.f.b(proc.h.shift());
		}
		else // if (rootTag === 3 || rootTag === 4)
		{
			proc.g = {
				$: rootTag === 3 ? 0 : 1,
				b: proc.f.b,
				i: proc.g
			};
			proc.f = proc.f.d;
		}
	}
}



function _Process_sleep(time)
{
	return _Scheduler_binding(function(callback) {
		var id = setTimeout(function() {
			callback(_Scheduler_succeed(_Utils_Tuple0));
		}, time);

		return function() { clearTimeout(id); };
	});
}




// PROGRAMS


var _Platform_worker = F4(function(impl, flagDecoder, debugMetadata, args)
{
	return _Platform_initialize(
		flagDecoder,
		args,
		impl.init,
		impl.update,
		impl.subscriptions,
		function() { return function() {} }
	);
});



// INITIALIZE A PROGRAM


function _Platform_initialize(flagDecoder, args, init, update, subscriptions, stepperBuilder)
{
	var result = A2(_Json_run, flagDecoder, _Json_wrap(args ? args['flags'] : undefined));
	$elm$core$Result$isOk(result) || _Debug_crash(2 /**/, _Json_errorToString(result.a) /**/);
	var managers = {};
	var initPair = init(result.a);
	var model = initPair.a;
	var stepper = stepperBuilder(sendToApp, model);
	var ports = _Platform_setupEffects(managers, sendToApp);

	function sendToApp(msg, viewMetadata)
	{
		var pair = A2(update, msg, model);
		stepper(model = pair.a, viewMetadata);
		_Platform_enqueueEffects(managers, pair.b, subscriptions(model));
	}

	_Platform_enqueueEffects(managers, initPair.b, subscriptions(model));

	return ports ? { ports: ports } : {};
}



// TRACK PRELOADS
//
// This is used by code in elm/browser and elm/http
// to register any HTTP requests that are triggered by init.
//


var _Platform_preload;


function _Platform_registerPreload(url)
{
	_Platform_preload.add(url);
}



// EFFECT MANAGERS


var _Platform_effectManagers = {};


function _Platform_setupEffects(managers, sendToApp)
{
	var ports;

	// setup all necessary effect managers
	for (var key in _Platform_effectManagers)
	{
		var manager = _Platform_effectManagers[key];

		if (manager.a)
		{
			ports = ports || {};
			ports[key] = manager.a(key, sendToApp);
		}

		managers[key] = _Platform_instantiateManager(manager, sendToApp);
	}

	return ports;
}


function _Platform_createManager(init, onEffects, onSelfMsg, cmdMap, subMap)
{
	return {
		b: init,
		c: onEffects,
		d: onSelfMsg,
		e: cmdMap,
		f: subMap
	};
}


function _Platform_instantiateManager(info, sendToApp)
{
	var router = {
		g: sendToApp,
		h: undefined
	};

	var onEffects = info.c;
	var onSelfMsg = info.d;
	var cmdMap = info.e;
	var subMap = info.f;

	function loop(state)
	{
		return A2(_Scheduler_andThen, loop, _Scheduler_receive(function(msg)
		{
			var value = msg.a;

			if (msg.$ === 0)
			{
				return A3(onSelfMsg, router, value, state);
			}

			return cmdMap && subMap
				? A4(onEffects, router, value.i, value.j, state)
				: A3(onEffects, router, cmdMap ? value.i : value.j, state);
		}));
	}

	return router.h = _Scheduler_rawSpawn(A2(_Scheduler_andThen, loop, info.b));
}



// ROUTING


var _Platform_sendToApp = F2(function(router, msg)
{
	return _Scheduler_binding(function(callback)
	{
		router.g(msg);
		callback(_Scheduler_succeed(_Utils_Tuple0));
	});
});


var _Platform_sendToSelf = F2(function(router, msg)
{
	return A2(_Scheduler_send, router.h, {
		$: 0,
		a: msg
	});
});



// BAGS


function _Platform_leaf(home)
{
	return function(value)
	{
		return {
			$: 1,
			k: home,
			l: value
		};
	};
}


function _Platform_batch(list)
{
	return {
		$: 2,
		m: list
	};
}


var _Platform_map = F2(function(tagger, bag)
{
	return {
		$: 3,
		n: tagger,
		o: bag
	}
});



// PIPE BAGS INTO EFFECT MANAGERS
//
// Effects must be queued!
//
// Say your init contains a synchronous command, like Time.now or Time.here
//
//   - This will produce a batch of effects (FX_1)
//   - The synchronous task triggers the subsequent `update` call
//   - This will produce a batch of effects (FX_2)
//
// If we just start dispatching FX_2, subscriptions from FX_2 can be processed
// before subscriptions from FX_1. No good! Earlier versions of this code had
// this problem, leading to these reports:
//
//   https://github.com/elm/core/issues/980
//   https://github.com/elm/core/pull/981
//   https://github.com/elm/compiler/issues/1776
//
// The queue is necessary to avoid ordering issues for synchronous commands.


// Why use true/false here? Why not just check the length of the queue?
// The goal is to detect "are we currently dispatching effects?" If we
// are, we need to bail and let the ongoing while loop handle things.
//
// Now say the queue has 1 element. When we dequeue the final element,
// the queue will be empty, but we are still actively dispatching effects.
// So you could get queue jumping in a really tricky category of cases.
//
var _Platform_effectsQueue = [];
var _Platform_effectsActive = false;


function _Platform_enqueueEffects(managers, cmdBag, subBag)
{
	_Platform_effectsQueue.push({ p: managers, q: cmdBag, r: subBag });

	if (_Platform_effectsActive) return;

	_Platform_effectsActive = true;
	for (var fx; fx = _Platform_effectsQueue.shift(); )
	{
		_Platform_dispatchEffects(fx.p, fx.q, fx.r);
	}
	_Platform_effectsActive = false;
}


function _Platform_dispatchEffects(managers, cmdBag, subBag)
{
	var effectsDict = {};
	_Platform_gatherEffects(true, cmdBag, effectsDict, null);
	_Platform_gatherEffects(false, subBag, effectsDict, null);

	for (var home in managers)
	{
		_Scheduler_rawSend(managers[home], {
			$: 'fx',
			a: effectsDict[home] || { i: _List_Nil, j: _List_Nil }
		});
	}
}


function _Platform_gatherEffects(isCmd, bag, effectsDict, taggers)
{
	switch (bag.$)
	{
		case 1:
			var home = bag.k;
			var effect = _Platform_toEffect(isCmd, home, taggers, bag.l);
			effectsDict[home] = _Platform_insert(isCmd, effect, effectsDict[home]);
			return;

		case 2:
			for (var list = bag.m; list.b; list = list.b) // WHILE_CONS
			{
				_Platform_gatherEffects(isCmd, list.a, effectsDict, taggers);
			}
			return;

		case 3:
			_Platform_gatherEffects(isCmd, bag.o, effectsDict, {
				s: bag.n,
				t: taggers
			});
			return;
	}
}


function _Platform_toEffect(isCmd, home, taggers, value)
{
	function applyTaggers(x)
	{
		for (var temp = taggers; temp; temp = temp.t)
		{
			x = temp.s(x);
		}
		return x;
	}

	var map = isCmd
		? _Platform_effectManagers[home].e
		: _Platform_effectManagers[home].f;

	return A2(map, applyTaggers, value)
}


function _Platform_insert(isCmd, newEffect, effects)
{
	effects = effects || { i: _List_Nil, j: _List_Nil };

	isCmd
		? (effects.i = _List_Cons(newEffect, effects.i))
		: (effects.j = _List_Cons(newEffect, effects.j));

	return effects;
}



// PORTS


function _Platform_checkPortName(name)
{
	if (_Platform_effectManagers[name])
	{
		_Debug_crash(3, name)
	}
}



// OUTGOING PORTS


function _Platform_outgoingPort(name, converter)
{
	_Platform_checkPortName(name);
	_Platform_effectManagers[name] = {
		e: _Platform_outgoingPortMap,
		u: converter,
		a: _Platform_setupOutgoingPort
	};
	return _Platform_leaf(name);
}


var _Platform_outgoingPortMap = F2(function(tagger, value) { return value; });


function _Platform_setupOutgoingPort(name)
{
	var subs = [];
	var converter = _Platform_effectManagers[name].u;

	// CREATE MANAGER

	var init = _Process_sleep(0);

	_Platform_effectManagers[name].b = init;
	_Platform_effectManagers[name].c = F3(function(router, cmdList, state)
	{
		for ( ; cmdList.b; cmdList = cmdList.b) // WHILE_CONS
		{
			// grab a separate reference to subs in case unsubscribe is called
			var currentSubs = subs;
			var value = _Json_unwrap(converter(cmdList.a));
			for (var i = 0; i < currentSubs.length; i++)
			{
				currentSubs[i](value);
			}
		}
		return init;
	});

	// PUBLIC API

	function subscribe(callback)
	{
		subs.push(callback);
	}

	function unsubscribe(callback)
	{
		// copy subs into a new array in case unsubscribe is called within a
		// subscribed callback
		subs = subs.slice();
		var index = subs.indexOf(callback);
		if (index >= 0)
		{
			subs.splice(index, 1);
		}
	}

	return {
		subscribe: subscribe,
		unsubscribe: unsubscribe
	};
}



// INCOMING PORTS


function _Platform_incomingPort(name, converter)
{
	_Platform_checkPortName(name);
	_Platform_effectManagers[name] = {
		f: _Platform_incomingPortMap,
		u: converter,
		a: _Platform_setupIncomingPort
	};
	return _Platform_leaf(name);
}


var _Platform_incomingPortMap = F2(function(tagger, finalTagger)
{
	return function(value)
	{
		return tagger(finalTagger(value));
	};
});


function _Platform_setupIncomingPort(name, sendToApp)
{
	var subs = _List_Nil;
	var converter = _Platform_effectManagers[name].u;

	// CREATE MANAGER

	var init = _Scheduler_succeed(null);

	_Platform_effectManagers[name].b = init;
	_Platform_effectManagers[name].c = F3(function(router, subList, state)
	{
		subs = subList;
		return init;
	});

	// PUBLIC API

	function send(incomingValue)
	{
		var result = A2(_Json_run, converter, _Json_wrap(incomingValue));

		$elm$core$Result$isOk(result) || _Debug_crash(4, name, result.a);

		var value = result.a;
		for (var temp = subs; temp.b; temp = temp.b) // WHILE_CONS
		{
			sendToApp(temp.a(value));
		}
	}

	return { send: send };
}



// EXPORT ELM MODULES
//
// Have DEBUG and PROD versions so that we can (1) give nicer errors in
// debug mode and (2) not pay for the bits needed for that in prod mode.
//




function _Platform_mergeExportsProd(obj, exports)
{
	for (var name in exports)
	{
		(name in obj)
			? (name == 'init')
				? _Debug_crash(6)
				: _Platform_mergeExportsProd(obj[name], exports[name])
			: (obj[name] = exports[name]);
	}
}


function _Platform_export(exports)
{
	scope['Elm']
		? _Platform_mergeExportsDebug('Elm', scope['Elm'], exports)
		: scope['Elm'] = exports;
}


function _Platform_mergeExportsDebug(moduleName, obj, exports)
{
	for (var name in exports)
	{
		(name in obj)
			? (name == 'init')
				? _Debug_crash(6, moduleName)
				: _Platform_mergeExportsDebug(moduleName + '.' + name, obj[name], exports[name])
			: (obj[name] = exports[name]);
	}
}



var _Lynx_g = (typeof globalThis !== 'undefined' ? globalThis : scope);
function _Lynx_papi(name) { return _Lynx_g['_' + '_' + name] || function() {}; }
var _Lynx_createViewFn = _Lynx_papi('CreateView');
var _Lynx_createTextFn = _Lynx_papi('CreateText');
var _Lynx_createImageFn = _Lynx_papi('CreateImage');
function _Lynx_createElement(tag) {
	var pId = (_Lynx_g['native'] && _Lynx_g['native']['currentPageId']) || 0;
	return (tag === 'text' ? _Lynx_createTextFn
		: tag === 'image' ? _Lynx_createImageFn
		: _Lynx_createViewFn)(pId);
}
var _Lynx_createRawText = _Lynx_papi('CreateRawText');
var _Lynx_appendChild = _Lynx_papi('AppendElement');
var _Lynx_removeElement = _Lynx_papi('RemoveElement');
var _Lynx_replaceElement = _Lynx_papi('ReplaceElement');
var _Lynx_insertBefore = _Lynx_papi('InsertElementBefore');
var _Lynx_setAttribute = _Lynx_papi('SetAttribute');
var _Lynx_getChildren = _Lynx_papi('GetChildren');
var _Lynx_getParent = _Lynx_papi('GetParent');
var _Lynx_addEvent = _Lynx_papi('AddEvent');
var _Lynx_setInlineStyles = _Lynx_papi('SetInlineStyles');
var _VirtualDom_elementMeta = new WeakMap();
function _VirtualDom_getMeta(el) {
	var meta = _VirtualDom_elementMeta.get(el);
	if (!meta) { meta = {}; _VirtualDom_elementMeta.set(el, meta); }
	return meta;
}


// HELPERS





function _VirtualDom_appendChild(parent, child)
{
	_Lynx_appendChild(parent, child);
}

var _VirtualDom_init = F4(function(virtualNode, flagDecoder, debugMetadata, args)
{
	// NOTE: this function needs _Platform_export available to work
	var rootPage = args['node'] || _Lynx_g['page'];
	var tree = _VirtualDom_render(virtualNode, function() {});
	_Lynx_appendChild(rootPage, tree);
	return {};
});



// TEXT


function _VirtualDom_text(string)
{
	return {
		$: 0,
		a: string
	};
}



// NODE


var _VirtualDom_nodeNS = F2(function(namespace, tag)
{
	return F2(function(factList, kidList)
	{
		for (var kids = [], descendantsCount = 0; kidList.b; kidList = kidList.b) // WHILE_CONS
		{
			var kid = kidList.a;
			descendantsCount += (kid.b || 0);
			kids.push(kid);
		}
		descendantsCount += kids.length;

		return {
			$: 1,
			c: tag,
			d: _VirtualDom_organizeFacts(factList),
			e: kids,
			f: namespace,
			b: descendantsCount
		};
	});
});


var _VirtualDom_node = _VirtualDom_nodeNS(undefined);



// KEYED NODE


var _VirtualDom_keyedNodeNS = F2(function(namespace, tag)
{
	return F2(function(factList, kidList)
	{
		for (var kids = [], descendantsCount = 0; kidList.b; kidList = kidList.b) // WHILE_CONS
		{
			var kid = kidList.a;
			descendantsCount += (kid.b.b || 0);
			kids.push(kid);
		}
		descendantsCount += kids.length;

		return {
			$: 2,
			c: tag,
			d: _VirtualDom_organizeFacts(factList),
			e: kids,
			f: namespace,
			b: descendantsCount
		};
	});
});


var _VirtualDom_keyedNode = _VirtualDom_keyedNodeNS(undefined);



// CUSTOM


function _VirtualDom_custom(factList, model, render, diff)
{
	return {
		$: 3,
		d: _VirtualDom_organizeFacts(factList),
		g: model,
		h: render,
		i: diff
	};
}



// MAP


var _VirtualDom_map = F2(function(tagger, node)
{
	return {
		$: 4,
		j: tagger,
		k: node,
		b: 1 + (node.b || 0)
	};
});



// LAZY


function _VirtualDom_thunk(refs, thunk)
{
	return {
		$: 5,
		l: refs,
		m: thunk,
		k: undefined
	};
}

var _VirtualDom_lazy = F2(function(func, a)
{
	return _VirtualDom_thunk([func, a], function() {
		return func(a);
	});
});

var _VirtualDom_lazy2 = F3(function(func, a, b)
{
	return _VirtualDom_thunk([func, a, b], function() {
		return A2(func, a, b);
	});
});

var _VirtualDom_lazy3 = F4(function(func, a, b, c)
{
	return _VirtualDom_thunk([func, a, b, c], function() {
		return A3(func, a, b, c);
	});
});

var _VirtualDom_lazy4 = F5(function(func, a, b, c, d)
{
	return _VirtualDom_thunk([func, a, b, c, d], function() {
		return A4(func, a, b, c, d);
	});
});

var _VirtualDom_lazy5 = F6(function(func, a, b, c, d, e)
{
	return _VirtualDom_thunk([func, a, b, c, d, e], function() {
		return A5(func, a, b, c, d, e);
	});
});

var _VirtualDom_lazy6 = F7(function(func, a, b, c, d, e, f)
{
	return _VirtualDom_thunk([func, a, b, c, d, e, f], function() {
		return A6(func, a, b, c, d, e, f);
	});
});

var _VirtualDom_lazy7 = F8(function(func, a, b, c, d, e, f, g)
{
	return _VirtualDom_thunk([func, a, b, c, d, e, f, g], function() {
		return A7(func, a, b, c, d, e, f, g);
	});
});

var _VirtualDom_lazy8 = F9(function(func, a, b, c, d, e, f, g, h)
{
	return _VirtualDom_thunk([func, a, b, c, d, e, f, g, h], function() {
		return A8(func, a, b, c, d, e, f, g, h);
	});
});



// FACTS


var _VirtualDom_on = F2(function(key, handler)
{
	return {
		$: 'a0',
		n: key,
		o: handler
	};
});
var _VirtualDom_style = F2(function(key, value)
{
	return {
		$: 'a1',
		n: key,
		o: value
	};
});
var _VirtualDom_property = F2(function(key, value)
{
	return {
		$: 'a2',
		n: key,
		o: value
	};
});
var _VirtualDom_attribute = F2(function(key, value)
{
	return {
		$: 'a3',
		n: key,
		o: value
	};
});
var _VirtualDom_attributeNS = F3(function(namespace, key, value)
{
	return {
		$: 'a4',
		n: key,
		o: { f: namespace, o: value }
	};
});



// XSS ATTACK VECTOR CHECKS
//
// For some reason, tabs can appear in href protocols and it still works.
// So '\tjava\tSCRIPT:alert("!!!")' and 'javascript:alert("!!!")' are the same
// in practice. That is why _VirtualDom_RE_js and _VirtualDom_RE_js_html look
// so freaky.
//
// Pulling the regular expressions out to the top level gives a slight speed
// boost in small benchmarks (4-10%) but hoisting values to reduce allocation
// can be unpredictable in large programs where JIT may have a harder time with
// functions are not fully self-contained. The benefit is more that the js and
// js_html ones are so weird that I prefer to see them near each other.





function _VirtualDom_noScript(tag)
{
	return tag;
}

function _VirtualDom_noOnOrFormAction(key)
{
	return key;
}

function _VirtualDom_noInnerHtmlOrFormAction(key)
{
	return key;
}

function _VirtualDom_noJavaScriptUri(value)
{
	return value;
}

function _VirtualDom_noJavaScriptOrHtmlUri(value)
{
	return value;
}

function _VirtualDom_noJavaScriptOrHtmlJson(value)
{
	return value;
}



// MAP FACTS


var _VirtualDom_mapAttribute = F2(function(func, attr)
{
	return (attr.$ === 'a0')
		? A2(_VirtualDom_on, attr.n, _VirtualDom_mapHandler(func, attr.o))
		: attr;
});

function _VirtualDom_mapHandler(func, handler)
{
	var tag = $lynxjs_elm$virtual_dom$VirtualDom$toHandlerInt(handler);

	// 0 = Normal
	// 1 = MayStopPropagation
	// 2 = MayPreventDefault
	// 3 = Custom

	return {
		$: handler.$,
		a:
			!tag
				? A2($elm$json$Json$Decode$map, func, handler.a)
				:
			A3($elm$json$Json$Decode$map2,
				tag < 3
					? _VirtualDom_mapEventTuple
					: _VirtualDom_mapEventRecord,
				$elm$json$Json$Decode$succeed(func),
				handler.a
			)
	};
}

var _VirtualDom_mapEventTuple = F2(function(func, tuple)
{
	return _Utils_Tuple2(func(tuple.a), tuple.b);
});

var _VirtualDom_mapEventRecord = F2(function(func, record)
{
	return {
		message: func(record.message),
		stopPropagation: record.stopPropagation,
		preventDefault: record.preventDefault
	}
});



// ORGANIZE FACTS


function _VirtualDom_organizeFacts(factList)
{
	for (var facts = {}; factList.b; factList = factList.b) // WHILE_CONS
	{
		var entry = factList.a;

		var tag = entry.$;
		var key = entry.n;
		var value = entry.o;

		if (tag === 'a2')
		{
			(key === 'className')
				? _VirtualDom_addClass(facts, key, _Json_unwrap(value))
				: facts[key] = _Json_unwrap(value);

			continue;
		}

		var subFacts = facts[tag] || (facts[tag] = {});
		(tag === 'a3' && key === 'class')
			? _VirtualDom_addClass(subFacts, key, value)
			: subFacts[key] = value;
	}

	return facts;
}

function _VirtualDom_addClass(object, key, newClass)
{
	var classes = object[key];
	object[key] = classes ? classes + ' ' + newClass : newClass;
}



// RENDER


function _VirtualDom_render(vNode, eventNode)
{
	var tag = vNode.$;

	if (tag === 5)
	{
		return _VirtualDom_render(vNode.k || (vNode.k = vNode.m()), eventNode);
	}

	if (tag === 0)
	{
		return _Lynx_createRawText(vNode.a);
	}

	if (tag === 4)
	{
		var subNode = vNode.k;
		var tagger = vNode.j;

		while (subNode.$ === 4)
		{
			typeof tagger !== 'object'
				? tagger = [tagger, subNode.j]
				: tagger.push(subNode.j);

			subNode = subNode.k;
		}

		var subEventRoot = { j: tagger, p: eventNode };
		var domNode = _VirtualDom_render(subNode, subEventRoot);
		_VirtualDom_getMeta(domNode).elm_event_node_ref = subEventRoot;
		return domNode;
	}

	if (tag === 3)
	{
		var domNode = vNode.h(vNode.g);
		_VirtualDom_applyFacts(domNode, eventNode, vNode.d);
		return domNode;
	}

	// at this point `tag` must be 1 or 2

	var domNode = _Lynx_createElement(vNode.c);

	_VirtualDom_applyFacts(domNode, eventNode, vNode.d);

	for (var kids = vNode.e, i = 0; i < kids.length; i++)
	{
		var kid = tag === 1 ? kids[i] : kids[i].b;
		if (kid.$ === 0)
		{
			_Lynx_appendChild(domNode, _Lynx_createRawText(kid.a));
		}
		else
		{
			_VirtualDom_appendChild(domNode, _VirtualDom_render(kid, eventNode));
		}
	}

	return domNode;
}



// APPLY FACTS


function _VirtualDom_applyFacts(domNode, eventNode, facts)
{
	for (var key in facts)
	{
		var value = facts[key];

		key === 'a1'
			? _VirtualDom_applyStyles(domNode, value)
			:
		key === 'a0'
			? _VirtualDom_applyEvents(domNode, eventNode, value)
			:
		key === 'a3'
			? _VirtualDom_applyAttrs(domNode, value)
			:
		key === 'a4'
			? _VirtualDom_applyAttrsNS(domNode, value)
			:
		(key !== 'value' && key !== 'checked' || domNode[key] !== value) && _Lynx_setAttribute(domNode, key === 'className' ? 'class' : key, String(value));
	}
}



// APPLY STYLES


function _VirtualDom_applyStyles(domNode, styles)
{
	_Lynx_setInlineStyles(domNode, styles);
}



// APPLY ATTRS


function _VirtualDom_applyAttrs(domNode, attrs)
{
	for (var key in attrs)
	{
		var value = attrs[key];
		if (typeof value !== 'undefined')
		{
			_Lynx_setAttribute(domNode, key, value);
		}
	}
}



// APPLY NAMESPACED ATTRS


function _VirtualDom_applyAttrsNS(domNode, nsAttrs)
{
	for (var key in nsAttrs)
	{
		var pair = nsAttrs[key];
		var value = pair.o;

		if (typeof value !== 'undefined')
		{
			_Lynx_setAttribute(domNode, key, value);
		}
	}
}



// APPLY EVENTS


function _VirtualDom_applyEvents(domNode, eventNode, events)
{
	var meta = _VirtualDom_getMeta(domNode);
	var allCallbacks = meta.elmFs || (meta.elmFs = {});

	for (var key in events)
	{
		var newHandler = events[key];
		var oldCallback = allCallbacks[key];

		if (!newHandler)
		{
			allCallbacks[key] = undefined;
			continue;
		}

		if (oldCallback)
		{
			var oldHandler = oldCallback.q;
			if (oldHandler.$ === newHandler.$)
			{
				oldCallback.q = newHandler;
				continue;
			}
		}

		oldCallback = _VirtualDom_makeCallback(eventNode, newHandler);
		allCallbacks[key] = oldCallback;

		var lynxEventName = _VirtualDom_mapEventName(key);
		var handlerType = $lynxjs_elm$virtual_dom$VirtualDom$toHandlerInt(newHandler);
		var prefix = (handlerType === 1) ? 'catch' : 'bind';
		_Lynx_addEvent(domNode, 'catchEvent', lynxEventName, { type: 'worklet', value: oldCallback });
	}
}

function _VirtualDom_mapEventName(name)
{
	switch (name)
	{
		case 'click': return 'tap';
		case 'dblclick': return 'tap';
		case 'mousedown': return 'touchstart';
		case 'mousemove': return 'touchmove';
		case 'mouseup': return 'touchend';
		default: return name;
	}
}



// PASSIVE EVENTS



// EVENT HANDLERS


function _VirtualDom_makeCallback(eventNode, initialHandler)
{
	function callback(event)
	{
		var handler = callback.q;
		var result = _Json_runHelp(handler.a, event);

		if (!$elm$core$Result$isOk(result))
		{
			return;
		}

		var tag = $lynxjs_elm$virtual_dom$VirtualDom$toHandlerInt(handler);

		// 0 = Normal
		// 1 = MayStopPropagation
		// 2 = MayPreventDefault
		// 3 = Custom

		var value = result.a;
		var message = !tag ? value : tag < 3 ? value.a : value.message;
		var stopPropagation = tag == 1 ? value.b : tag == 3 && value.stopPropagation;
		var currentEventNode = eventNode;
		var tagger;
		var i;
		while (tagger = currentEventNode.j)
		{
			if (typeof tagger == 'function')
			{
				message = tagger(message);
			}
			else
			{
				for (var i = tagger.length; i--; )
				{
					message = tagger[i](message);
				}
			}
			currentEventNode = currentEventNode.p;
		}
		currentEventNode(message, stopPropagation); // stopPropagation implies isSync
	}

	callback.q = initialHandler;

	return callback;
}

function _VirtualDom_equalEvents(x, y)
{
	return x.$ == y.$ && _Json_equality(x.a, y.a);
}



// DIFF


// TODO: Should we do patches like in iOS?
//
// type Patch
//   = At Int Patch
//   | Batch (List Patch)
//   | Change ...
//
// How could it not be better?
//
function _VirtualDom_diff(x, y)
{
	var patches = [];
	_VirtualDom_diffHelp(x, y, patches, 0);
	return patches;
}


function _VirtualDom_pushPatch(patches, type, index, data)
{
	var patch = {
		$: type,
		r: index,
		s: data,
		t: undefined,
		u: undefined
	};
	patches.push(patch);
	return patch;
}


function _VirtualDom_diffHelp(x, y, patches, index)
{
	if (x === y)
	{
		return;
	}

	var xType = x.$;
	var yType = y.$;

	// Bail if you run into different types of nodes. Implies that the
	// structure has changed significantly and it's not worth a diff.
	if (xType !== yType)
	{
		if (xType === 1 && yType === 2)
		{
			y = _VirtualDom_dekey(y);
			yType = 1;
		}
		else
		{
			_VirtualDom_pushPatch(patches, 0, index, y);
			return;
		}
	}

	// Now we know that both nodes are the same $.
	switch (yType)
	{
		case 5:
			var xRefs = x.l;
			var yRefs = y.l;
			var i = xRefs.length;
			var same = i === yRefs.length;
			while (same && i--)
			{
				same = xRefs[i] === yRefs[i];
			}
			if (same)
			{
				y.k = x.k;
				return;
			}
			y.k = y.m();
			var subPatches = [];
			_VirtualDom_diffHelp(x.k, y.k, subPatches, 0);
			subPatches.length > 0 && _VirtualDom_pushPatch(patches, 1, index, subPatches);
			return;

		case 4:
			// gather nested taggers
			var xTaggers = x.j;
			var yTaggers = y.j;
			var nesting = false;

			var xSubNode = x.k;
			while (xSubNode.$ === 4)
			{
				nesting = true;

				typeof xTaggers !== 'object'
					? xTaggers = [xTaggers, xSubNode.j]
					: xTaggers.push(xSubNode.j);

				xSubNode = xSubNode.k;
			}

			var ySubNode = y.k;
			while (ySubNode.$ === 4)
			{
				nesting = true;

				typeof yTaggers !== 'object'
					? yTaggers = [yTaggers, ySubNode.j]
					: yTaggers.push(ySubNode.j);

				ySubNode = ySubNode.k;
			}

			// Just bail if different numbers of taggers. This implies the
			// structure of the virtual DOM has changed.
			if (nesting && xTaggers.length !== yTaggers.length)
			{
				_VirtualDom_pushPatch(patches, 0, index, y);
				return;
			}

			// check if taggers are "the same"
			if (nesting ? !_VirtualDom_pairwiseRefEqual(xTaggers, yTaggers) : xTaggers !== yTaggers)
			{
				_VirtualDom_pushPatch(patches, 2, index, yTaggers);
			}

			// diff everything below the taggers
			_VirtualDom_diffHelp(xSubNode, ySubNode, patches, index + 1);
			return;

		case 0:
			if (x.a !== y.a)
			{
				_VirtualDom_pushPatch(patches, 3, index, y.a);
			}
			return;

		case 1:
			_VirtualDom_diffNodes(x, y, patches, index, _VirtualDom_diffKids);
			return;

		case 2:
			_VirtualDom_diffNodes(x, y, patches, index, _VirtualDom_diffKeyedKids);
			return;

		case 3:
			if (x.h !== y.h)
			{
				_VirtualDom_pushPatch(patches, 0, index, y);
				return;
			}

			var factsDiff = _VirtualDom_diffFacts(x.d, y.d);
			factsDiff && _VirtualDom_pushPatch(patches, 4, index, factsDiff);

			var patch = y.i(x.g, y.g);
			patch && _VirtualDom_pushPatch(patches, 5, index, patch);

			return;
	}
}

// assumes the incoming arrays are the same length
function _VirtualDom_pairwiseRefEqual(as, bs)
{
	for (var i = 0; i < as.length; i++)
	{
		if (as[i] !== bs[i])
		{
			return false;
		}
	}

	return true;
}

function _VirtualDom_diffNodes(x, y, patches, index, diffKids)
{
	// Bail if obvious indicators have changed. Implies more serious
	// structural changes such that it's not worth it to diff.
	if (x.c !== y.c || x.f !== y.f)
	{
		_VirtualDom_pushPatch(patches, 0, index, y);
		return;
	}

	var factsDiff = _VirtualDom_diffFacts(x.d, y.d);
	factsDiff && _VirtualDom_pushPatch(patches, 4, index, factsDiff);

	diffKids(x, y, patches, index);
}



// DIFF FACTS


// TODO Instead of creating a new diff object, it's possible to just test if
// there *is* a diff. During the actual patch, do the diff again and make the
// modifications directly. This way, there's no new allocations. Worth it?
function _VirtualDom_diffFacts(x, y, category)
{
	var diff;

	// look for changes and removals
	for (var xKey in x)
	{
		if (xKey === 'a1' || xKey === 'a0' || xKey === 'a3' || xKey === 'a4')
		{
			var subDiff = _VirtualDom_diffFacts(x[xKey], y[xKey] || {}, xKey);
			if (subDiff)
			{
				diff = diff || {};
				diff[xKey] = subDiff;
			}
			continue;
		}

		// remove if not in the new facts
		if (!(xKey in y))
		{
			diff = diff || {};
			diff[xKey] =
				!category
					? (typeof x[xKey] === 'string' ? '' : null)
					:
				(category === 'a1')
					? ''
					:
				(category === 'a0' || category === 'a3')
					? undefined
					:
				{ f: x[xKey].f, o: undefined };

			continue;
		}

		var xValue = x[xKey];
		var yValue = y[xKey];

		// reference equal, so don't worry about it
		if (xValue === yValue && xKey !== 'value' && xKey !== 'checked'
			|| category === 'a0' && _VirtualDom_equalEvents(xValue, yValue))
		{
			continue;
		}

		diff = diff || {};
		diff[xKey] = yValue;
	}

	// add new stuff
	for (var yKey in y)
	{
		if (!(yKey in x))
		{
			diff = diff || {};
			diff[yKey] = y[yKey];
		}
	}

	return diff;
}



// DIFF KIDS


function _VirtualDom_diffKids(xParent, yParent, patches, index)
{
	var xKids = xParent.e;
	var yKids = yParent.e;

	var xLen = xKids.length;
	var yLen = yKids.length;

	// FIGURE OUT IF THERE ARE INSERTS OR REMOVALS

	if (xLen > yLen)
	{
		_VirtualDom_pushPatch(patches, 6, index, {
			v: yLen,
			i: xLen - yLen
		});
	}
	else if (xLen < yLen)
	{
		_VirtualDom_pushPatch(patches, 7, index, {
			v: xLen,
			e: yKids
		});
	}

	// PAIRWISE DIFF EVERYTHING ELSE

	for (var minLen = xLen < yLen ? xLen : yLen, i = 0; i < minLen; i++)
	{
		var xKid = xKids[i];
		_VirtualDom_diffHelp(xKid, yKids[i], patches, ++index);
		index += xKid.b || 0;
	}
}



// KEYED DIFF


function _VirtualDom_diffKeyedKids(xParent, yParent, patches, rootIndex)
{
	var localPatches = [];

	var changes = {}; // Dict String Entry
	var inserts = []; // Array { index : Int, entry : Entry }
	// type Entry = { tag : String, vnode : VNode, index : Int, data : _ }

	var xKids = xParent.e;
	var yKids = yParent.e;
	var xLen = xKids.length;
	var yLen = yKids.length;
	var xIndex = 0;
	var yIndex = 0;

	var index = rootIndex;

	while (xIndex < xLen && yIndex < yLen)
	{
		var x = xKids[xIndex];
		var y = yKids[yIndex];

		var xKey = x.a;
		var yKey = y.a;
		var xNode = x.b;
		var yNode = y.b;

		var newMatch = undefined;
		var oldMatch = undefined;

		// check if keys match

		if (xKey === yKey)
		{
			index++;
			_VirtualDom_diffHelp(xNode, yNode, localPatches, index);
			index += xNode.b || 0;

			xIndex++;
			yIndex++;
			continue;
		}

		// look ahead 1 to detect insertions and removals.

		var xNext = xKids[xIndex + 1];
		var yNext = yKids[yIndex + 1];

		if (xNext)
		{
			var xNextKey = xNext.a;
			var xNextNode = xNext.b;
			oldMatch = yKey === xNextKey;
		}

		if (yNext)
		{
			var yNextKey = yNext.a;
			var yNextNode = yNext.b;
			newMatch = xKey === yNextKey;
		}


		// swap x and y
		if (newMatch && oldMatch)
		{
			index++;
			_VirtualDom_diffHelp(xNode, yNextNode, localPatches, index);
			_VirtualDom_insertNode(changes, localPatches, xKey, yNode, yIndex, inserts);
			index += xNode.b || 0;

			index++;
			_VirtualDom_removeNode(changes, localPatches, xKey, xNextNode, index);
			index += xNextNode.b || 0;

			xIndex += 2;
			yIndex += 2;
			continue;
		}

		// insert y
		if (newMatch)
		{
			index++;
			_VirtualDom_insertNode(changes, localPatches, yKey, yNode, yIndex, inserts);
			_VirtualDom_diffHelp(xNode, yNextNode, localPatches, index);
			index += xNode.b || 0;

			xIndex += 1;
			yIndex += 2;
			continue;
		}

		// remove x
		if (oldMatch)
		{
			index++;
			_VirtualDom_removeNode(changes, localPatches, xKey, xNode, index);
			index += xNode.b || 0;

			index++;
			_VirtualDom_diffHelp(xNextNode, yNode, localPatches, index);
			index += xNextNode.b || 0;

			xIndex += 2;
			yIndex += 1;
			continue;
		}

		// remove x, insert y
		if (xNext && xNextKey === yNextKey)
		{
			index++;
			_VirtualDom_removeNode(changes, localPatches, xKey, xNode, index);
			_VirtualDom_insertNode(changes, localPatches, yKey, yNode, yIndex, inserts);
			index += xNode.b || 0;

			index++;
			_VirtualDom_diffHelp(xNextNode, yNextNode, localPatches, index);
			index += xNextNode.b || 0;

			xIndex += 2;
			yIndex += 2;
			continue;
		}

		break;
	}

	// eat up any remaining nodes with removeNode and insertNode

	while (xIndex < xLen)
	{
		index++;
		var x = xKids[xIndex];
		var xNode = x.b;
		_VirtualDom_removeNode(changes, localPatches, x.a, xNode, index);
		index += xNode.b || 0;
		xIndex++;
	}

	while (yIndex < yLen)
	{
		var endInserts = endInserts || [];
		var y = yKids[yIndex];
		_VirtualDom_insertNode(changes, localPatches, y.a, y.b, undefined, endInserts);
		yIndex++;
	}

	if (localPatches.length > 0 || inserts.length > 0 || endInserts)
	{
		_VirtualDom_pushPatch(patches, 8, rootIndex, {
			w: localPatches,
			x: inserts,
			y: endInserts
		});
	}
}



// CHANGES FROM KEYED DIFF


var _VirtualDom_POSTFIX = '_elmW6BL';


function _VirtualDom_insertNode(changes, localPatches, key, vnode, yIndex, inserts)
{
	var entry = changes[key];

	// never seen this key before
	if (!entry)
	{
		entry = {
			c: 0,
			z: vnode,
			r: yIndex,
			s: undefined
		};

		inserts.push({ r: yIndex, A: entry });
		changes[key] = entry;

		return;
	}

	// this key was removed earlier, a match!
	if (entry.c === 1)
	{
		inserts.push({ r: yIndex, A: entry });

		entry.c = 2;
		var subPatches = [];
		_VirtualDom_diffHelp(entry.z, vnode, subPatches, entry.r);
		entry.r = yIndex;
		entry.s.s = {
			w: subPatches,
			A: entry
		};

		return;
	}

	// this key has already been inserted or moved, a duplicate!
	_VirtualDom_insertNode(changes, localPatches, key + _VirtualDom_POSTFIX, vnode, yIndex, inserts);
}


function _VirtualDom_removeNode(changes, localPatches, key, vnode, index)
{
	var entry = changes[key];

	// never seen this key before
	if (!entry)
	{
		var patch = _VirtualDom_pushPatch(localPatches, 9, index, undefined);

		changes[key] = {
			c: 1,
			z: vnode,
			r: index,
			s: patch
		};

		return;
	}

	// this key was inserted earlier, a match!
	if (entry.c === 0)
	{
		entry.c = 2;
		var subPatches = [];
		_VirtualDom_diffHelp(vnode, entry.z, subPatches, index);

		_VirtualDom_pushPatch(localPatches, 9, index, {
			w: subPatches,
			A: entry
		});

		return;
	}

	// this key has already been removed or moved, a duplicate!
	_VirtualDom_removeNode(changes, localPatches, key + _VirtualDom_POSTFIX, vnode, index);
}



// ADD DOM NODES
//
// Each DOM node has an "index" assigned in order of traversal. It is important
// to minimize our crawl over the actual DOM, so these indexes (along with the
// descendantsCount of virtual nodes) let us skip touching entire subtrees of
// the DOM if we know there are no patches there.


function _VirtualDom_addDomNodes(domNode, vNode, patches, eventNode)
{
	_VirtualDom_addDomNodesHelp(domNode, vNode, patches, 0, 0, vNode.b, eventNode);
}


// assumes `patches` is non-empty and indexes increase monotonically.
function _VirtualDom_addDomNodesHelp(domNode, vNode, patches, i, low, high, eventNode)
{
	var patch = patches[i];
	var index = patch.r;

	while (index === low)
	{
		var patchType = patch.$;

		if (patchType === 1)
		{
			_VirtualDom_addDomNodes(domNode, vNode.k, patch.s, eventNode);
		}
		else if (patchType === 8)
		{
			patch.t = domNode;
			patch.u = eventNode;

			var subPatches = patch.s.w;
			if (subPatches.length > 0)
			{
				_VirtualDom_addDomNodesHelp(domNode, vNode, subPatches, 0, low, high, eventNode);
			}
		}
		else if (patchType === 9)
		{
			patch.t = domNode;
			patch.u = eventNode;

			var data = patch.s;
			if (data)
			{
				data.A.s = domNode;
				var subPatches = data.w;
				if (subPatches.length > 0)
				{
					_VirtualDom_addDomNodesHelp(domNode, vNode, subPatches, 0, low, high, eventNode);
				}
			}
		}
		else
		{
			patch.t = domNode;
			patch.u = eventNode;
		}

		i++;

		if (!(patch = patches[i]) || (index = patch.r) > high)
		{
			return i;
		}
	}

	var tag = vNode.$;

	if (tag === 4)
	{
		var subNode = vNode.k;

		while (subNode.$ === 4)
		{
			subNode = subNode.k;
		}

		return _VirtualDom_addDomNodesHelp(domNode, subNode, patches, i, low + 1, high, _VirtualDom_getMeta(domNode).elm_event_node_ref);
	}

	// tag must be 1 or 2 at this point

	var vKids = vNode.e;
	var childNodes = _Lynx_getChildren(domNode);
	for (var j = 0; j < vKids.length; j++)
	{
		low++;
		var vKid = tag === 1 ? vKids[j] : vKids[j].b;
		var nextLow = low + (vKid.b || 0);
		if (low <= index && index <= nextLow)
		{
			i = _VirtualDom_addDomNodesHelp(childNodes[j], vKid, patches, i, low, nextLow, eventNode);
			if (!(patch = patches[i]) || (index = patch.r) > high)
			{
				return i;
			}
		}
		low = nextLow;
	}
	return i;
}



// APPLY PATCHES


function _VirtualDom_applyPatches(rootDomNode, oldVirtualNode, patches, eventNode)
{
	if (patches.length === 0)
	{
		return rootDomNode;
	}

	_VirtualDom_addDomNodes(rootDomNode, oldVirtualNode, patches, eventNode);
	return _VirtualDom_applyPatchesHelp(rootDomNode, patches);
}

function _VirtualDom_applyPatchesHelp(rootDomNode, patches)
{
	for (var i = 0; i < patches.length; i++)
	{
		var patch = patches[i];
		var localDomNode = patch.t
		var newNode = _VirtualDom_applyPatch(localDomNode, patch);
		if (localDomNode === rootDomNode)
		{
			rootDomNode = newNode;
		}
	}
	return rootDomNode;
}

function _VirtualDom_applyPatch(domNode, patch)
{
	switch (patch.$)
	{
		case 0:
			return _VirtualDom_applyPatchRedraw(domNode, patch.s, patch.u);

		case 4:
			_VirtualDom_applyFacts(domNode, patch.u, patch.s);
			return domNode;

		case 3:
			_Lynx_setAttribute(domNode, 'text', patch.s);
			return domNode;

		case 1:
			return _VirtualDom_applyPatchesHelp(domNode, patch.s);

		case 2:
			if (_VirtualDom_getMeta(domNode).elm_event_node_ref)
			{
				_VirtualDom_getMeta(domNode).elm_event_node_ref.j = patch.s;
			}
			else
			{
				_VirtualDom_getMeta(domNode).elm_event_node_ref = { j: patch.s, p: patch.u };
			}
			return domNode;

		case 6:
			var data = patch.s;
			for (var i = 0; i < data.i; i++)
			{
				var children = _Lynx_getChildren(domNode);
				_Lynx_removeElement(domNode, children[data.v]);
			}
			return domNode;

		case 7:
			var data = patch.s;
			var kids = data.e;
			for (var i = data.v; i < kids.length; i++)
			{
				_Lynx_appendChild(domNode, _VirtualDom_render(kids[i], patch.u));
			}
			return domNode;

		case 9:
			var data = patch.s;
			if (!data)
			{
				_Lynx_removeElement(_Lynx_getParent(domNode), domNode);
				return domNode;
			}
			var entry = data.A;
			if (typeof entry.r !== 'undefined')
			{
				_Lynx_removeElement(_Lynx_getParent(domNode), domNode);
			}
			entry.s = _VirtualDom_applyPatchesHelp(domNode, data.w);
			return domNode;

		case 8:
			return _VirtualDom_applyPatchReorder(domNode, patch);

		case 5:
			return patch.s(domNode);

		default:
			throw new Error('VirtualDom: unknown patch type');
	}
}


function _VirtualDom_applyPatchRedraw(domNode, vNode, eventNode)
{
	var parentNode = _Lynx_getParent(domNode);
	var newNode = _VirtualDom_render(vNode, eventNode);

	if (!_VirtualDom_getMeta(newNode).elm_event_node_ref)
	{
		_VirtualDom_getMeta(newNode).elm_event_node_ref = _VirtualDom_getMeta(domNode).elm_event_node_ref;
	}

	if (parentNode && newNode !== domNode)
	{
		_Lynx_replaceElement(parentNode, newNode, domNode);
	}
	return newNode;
}


function _VirtualDom_applyPatchReorder(domNode, patch)
{
	var data = patch.s;

	// remove end inserts
	var endInsertNodes = _VirtualDom_applyPatchReorderEndInsertsHelp(data.y, patch);

	// removals
	domNode = _VirtualDom_applyPatchesHelp(domNode, data.w);

	// inserts
	var inserts = data.x;
	for (var i = 0; i < inserts.length; i++)
	{
		var insert = inserts[i];
		var entry = insert.A;
		var node = entry.c === 2
			? entry.s
			: _VirtualDom_render(entry.z, patch.u);
		var children = _Lynx_getChildren(domNode);
		_Lynx_insertBefore(domNode, node, children[insert.r]);
	}

	// add end inserts
	if (endInsertNodes)
	{
		for (var i = 0; i < endInsertNodes.length; i++)
		{
			_Lynx_appendChild(domNode, endInsertNodes[i]);
		}
	}

	return domNode;
}


function _VirtualDom_applyPatchReorderEndInsertsHelp(endInserts, patch)
{
	if (!endInserts)
	{
		return;
	}

	var nodes = [];
	for (var i = 0; i < endInserts.length; i++)
	{
		var insert = endInserts[i];
		var entry = insert.A;
		nodes.push(entry.c === 2
			? entry.s
			: _VirtualDom_render(entry.z, patch.u)
		);
	}
	return nodes;
}


function _VirtualDom_dekey(keyedNode)
{
	var keyedKids = keyedNode.e;
	var len = keyedKids.length;
	var kids = new Array(len);
	for (var i = 0; i < len; i++)
	{
		kids[i] = keyedKids[i].b;
	}

	return {
		$: 1,
		c: keyedNode.c,
		d: keyedNode.d,
		e: kids,
		f: keyedNode.f,
		b: keyedNode.b
	};
}



// LYNXJS PAPI WRAPPERS
var _Browser_lynx = (typeof globalThis !== 'undefined' ? globalThis : scope);
function _Browser_newPage() {
	return _Browser_lynx['page'];
}
function _Browser_flush() {
	var fn = _Browser_lynx['_' + '_FlushElementTree'];
	if (typeof fn === 'function') { fn(); }
}



// ELEMENT


var _Browser_element = F4(function(impl, flagDecoder, debugMetadata, args)
{
	return _Platform_initialize(
		flagDecoder,
		args,
		impl.init,
		impl.update,
		impl.subscriptions,
		function(sendToApp, initialModel) {
			var view = impl.view;
			var domNode = args['node'] || _Browser_newPage();
			var currNode = view(initialModel);
			var currDomNode = _VirtualDom_render(currNode, sendToApp);
			_VirtualDom_appendChild(domNode, currDomNode);
			_Browser_flush();

			return _Browser_makeAnimator(initialModel, function(model)
			{
				var nextNode = view(model);
				var patches = _VirtualDom_diff(currNode, nextNode);
				currDomNode = _VirtualDom_applyPatches(currDomNode, currNode, patches, sendToApp);
				currNode = nextNode;
				_Browser_flush();
			});
		}
	);
});



// DOCUMENT


var _Browser_document = F4(function(impl, flagDecoder, debugMetadata, args)
{
	return _Platform_initialize(
		flagDecoder,
		args,
		impl.init,
		impl.update,
		impl.subscriptions,
		function(sendToApp, initialModel) {
			var view = impl.view;
			var rootNode = args['node'] || _Browser_newPage();
			var doc = view(initialModel);
			var currNode = _VirtualDom_node('view')(_List_Nil)(doc.body);
			var currDomNode = _VirtualDom_render(currNode, sendToApp);
			_VirtualDom_appendChild(rootNode, currDomNode);
			_Browser_flush();

			return _Browser_makeAnimator(initialModel, function(model)
			{
				var doc = view(model);
				var nextNode = _VirtualDom_node('view')(_List_Nil)(doc.body);
				var patches = _VirtualDom_diff(currNode, nextNode);
				currDomNode = _VirtualDom_applyPatches(currDomNode, currNode, patches, sendToApp);
				currNode = nextNode;
				_Browser_flush();
			});
		}
	);
});



// ANIMATION


var _Browser_cancelAnimationFrame =
	function(id) { clearTimeout(id); };

var _Browser_requestAnimationFrame =
	function(callback) { return setTimeout(callback, 1000 / 60); };


function _Browser_makeAnimator(model, draw)
{
	draw(model);

	var state = 0;

	function updateIfNeeded()
	{
		state = state === 1
			? 0
			: ( _Browser_requestAnimationFrame(updateIfNeeded), draw(model), 1 );
	}

	return function(nextModel, isSync)
	{
		model = nextModel;

		isSync
			? ( draw(model),
				state === 2 && (state = 1)
				)
			: ( state === 0 && _Browser_requestAnimationFrame(updateIfNeeded),
				state = 2
				);
	};
}



// APPLICATION


function _Browser_application(impl)
{
	return _Browser_document({
		init: function(flags)
		{
			return A3(impl.init, flags, _Browser_fakeUrl(), {});
		},
		view: impl.view,
		update: impl.update,
		subscriptions: impl.subscriptions
	});
}

function _Browser_fakeUrl()
{
	return {
		protocol: { $: 0 },
		host: 'localhost',
		port_: { $: 1 },
		path: '/',
		query: { $: 1 },
		fragment: { $: 1 }
	};
}



var _Browser_go = F2(function(key, n)
{
	return A2($elm$core$Task$perform, $elm$core$Basics$never, _Scheduler_binding(function() {
		// no-op in LynxJS
		key();
	}));
});

var _Browser_pushUrl = F2(function(key, url)
{
	return A2($elm$core$Task$perform, $elm$core$Basics$never, _Scheduler_binding(function() {
		// no-op in LynxJS
		key();
	}));
});

var _Browser_replaceUrl = F2(function(key, url)
{
	return A2($elm$core$Task$perform, $elm$core$Basics$never, _Scheduler_binding(function() {
		// no-op in LynxJS
		key();
	}));
});



// GLOBAL EVENTS


var _Browser_fakeNode = { addEventListener: function() {}, removeEventListener: function() {} };
var _Browser_doc = typeof document !== 'undefined' ? document : _Browser_fakeNode;
var _Browser_window = typeof window !== 'undefined' ? window : _Browser_fakeNode;

var _Browser_on = F3(function(node, eventName, sendToSelf)
{
	return _Scheduler_spawn(_Scheduler_binding(function(callback)
	{
		return function() {};
	}));
});

var _Browser_decodeEvent = F2(function(decoder, event)
{
	var result = _Json_runHelp(decoder, event);
	return $elm$core$Result$isOk(result) ? $elm$core$Maybe$Just(result.a) : $elm$core$Maybe$Nothing;
});



// PAGE VISIBILITY


function _Browser_visibilityInfo()
{
	return (typeof _VirtualDom_doc.hidden !== 'undefined')
		? { hidden: 'hidden', change: 'visibilitychange' }
		:
	(typeof _VirtualDom_doc.mozHidden !== 'undefined')
		? { hidden: 'mozHidden', change: 'mozvisibilitychange' }
		:
	(typeof _VirtualDom_doc.msHidden !== 'undefined')
		? { hidden: 'msHidden', change: 'msvisibilitychange' }
		:
	(typeof _VirtualDom_doc.webkitHidden !== 'undefined')
		? { hidden: 'webkitHidden', change: 'webkitvisibilitychange' }
		: { hidden: 'hidden', change: 'visibilitychange' };
}



// ANIMATION FRAMES


function _Browser_rAF()
{
	return _Scheduler_binding(function(callback)
	{
		var id = _Browser_requestAnimationFrame(function() {
			callback(_Scheduler_succeed(Date.now()));
		});

		return function() {
			_Browser_cancelAnimationFrame(id);
		};
	});
}


function _Browser_now()
{
	return _Scheduler_binding(function(callback)
	{
		callback(_Scheduler_succeed(Date.now()));
	});
}



// DOM STUFF


function _Browser_withNode(id, doStuff)
{
	return _Scheduler_binding(function(callback)
	{
		callback(_Scheduler_fail($lynxjs_elm$browser$Browser$Dom$NotFound(id)));
	});
}


function _Browser_withWindow(doStuff)
{
	return _Scheduler_binding(function(callback)
	{
		_Browser_requestAnimationFrame(function() {
			callback(_Scheduler_succeed(doStuff()));
		});
	});
}


// FOCUS and BLUR


var _Browser_call = F2(function(functionName, id)
{
	return _Browser_withNode(id, function(node) {
		node[functionName]();
		return _Utils_Tuple0;
	});
});



// WINDOW VIEWPORT


function _Browser_getViewport()
{
	return {
		scene: _Browser_getScene(),
		viewport: {
			x: _Browser_window.pageXOffset,
			y: _Browser_window.pageYOffset,
			width: _Browser_doc.documentElement.clientWidth,
			height: _Browser_doc.documentElement.clientHeight
		}
	};
}

function _Browser_getScene()
{
	var body = _Browser_doc.body;
	var elem = _Browser_doc.documentElement;
	return {
		width: Math.max(body.scrollWidth, body.offsetWidth, elem.scrollWidth, elem.offsetWidth, elem.clientWidth),
		height: Math.max(body.scrollHeight, body.offsetHeight, elem.scrollHeight, elem.offsetHeight, elem.clientHeight)
	};
}

var _Browser_setViewport = F2(function(x, y)
{
	return _Browser_withWindow(function()
	{
		_Browser_window.scroll(x, y);
		return _Utils_Tuple0;
	});
});



// ELEMENT VIEWPORT


function _Browser_getViewportOf(id)
{
	return _Browser_withNode(id, function(node)
	{
		return {
			scene: {
				width: node.scrollWidth,
				height: node.scrollHeight
			},
			viewport: {
				x: node.scrollLeft,
				y: node.scrollTop,
				width: node.clientWidth,
				height: node.clientHeight
			}
		};
	});
}


var _Browser_setViewportOf = F3(function(id, x, y)
{
	return _Browser_withNode(id, function(node)
	{
		node.scrollLeft = x;
		node.scrollTop = y;
		return _Utils_Tuple0;
	});
});



// ELEMENT


function _Browser_getElement(id)
{
	return _Browser_withNode(id, function(node)
	{
		var rect = node.getBoundingClientRect();
		var x = _Browser_window.pageXOffset;
		var y = _Browser_window.pageYOffset;
		return {
			scene: _Browser_getScene(),
			viewport: {
				x: x,
				y: y,
				width: _Browser_doc.documentElement.clientWidth,
				height: _Browser_doc.documentElement.clientHeight
			},
			element: {
				x: x + rect.left,
				y: y + rect.top,
				width: rect.width,
				height: rect.height
			}
		};
	});
}



// LOAD and RELOAD


function _Browser_reload(skipCache)
{
	return A2($elm$core$Task$perform, $elm$core$Basics$never, _Scheduler_binding(function(callback)
	{
		// no-op in LynxJS
	}));
}

function _Browser_load(url)
{
	return A2($elm$core$Task$perform, $elm$core$Basics$never, _Scheduler_binding(function(callback)
	{
		try
		{
			// no-op in LynxJS
		}
		catch(err)
		{
			// Only Firefox can throw a NS_ERROR_MALFORMED_URI exception here.
			// Other browsers reload the page, so let's be consistent about that.
			// no-op in LynxJS
		}
	}));
}



var _Bitwise_and = F2(function(a, b)
{
	return a & b;
});

var _Bitwise_or = F2(function(a, b)
{
	return a | b;
});

var _Bitwise_xor = F2(function(a, b)
{
	return a ^ b;
});

function _Bitwise_complement(a)
{
	return ~a;
};

var _Bitwise_shiftLeftBy = F2(function(offset, a)
{
	return a << offset;
});

var _Bitwise_shiftRightBy = F2(function(offset, a)
{
	return a >> offset;
});

var _Bitwise_shiftRightZfBy = F2(function(offset, a)
{
	return a >>> offset;
});



function _Time_now(millisToPosix)
{
	return _Scheduler_binding(function(callback)
	{
		callback(_Scheduler_succeed(millisToPosix(Date.now())));
	});
}

var _Time_setInterval = F2(function(interval, task)
{
	return _Scheduler_binding(function(callback)
	{
		var id = setInterval(function() { _Scheduler_rawSpawn(task); }, interval);
		return function() { clearInterval(id); };
	});
});

function _Time_here()
{
	return _Scheduler_binding(function(callback)
	{
		callback(_Scheduler_succeed(
			A2($elm$time$Time$customZone, -(new Date().getTimezoneOffset()), _List_Nil)
		));
	});
}


function _Time_getZoneName()
{
	return _Scheduler_binding(function(callback)
	{
		try
		{
			var name = $elm$time$Time$Name(Intl.DateTimeFormat().resolvedOptions().timeZone);
		}
		catch (e)
		{
			var name = $elm$time$Time$Offset(new Date().getTimezoneOffset());
		}
		callback(_Scheduler_succeed(name));
	});
}


// BYTES

function _Bytes_width(bytes)
{
	return bytes.byteLength;
}

var _Bytes_getHostEndianness = F2(function(le, be)
{
	return _Scheduler_binding(function(callback)
	{
		callback(_Scheduler_succeed(new Uint8Array(new Uint32Array([1]))[0] === 1 ? le : be));
	});
});


// ENCODERS

function _Bytes_encode(encoder)
{
	var mutableBytes = new DataView(new ArrayBuffer($elm$bytes$Bytes$Encode$getWidth(encoder)));
	$elm$bytes$Bytes$Encode$write(encoder)(mutableBytes)(0);
	return mutableBytes;
}


// SIGNED INTEGERS

var _Bytes_write_i8  = F3(function(mb, i, n) { mb.setInt8(i, n); return i + 1; });
var _Bytes_write_i16 = F4(function(mb, i, n, isLE) { mb.setInt16(i, n, isLE); return i + 2; });
var _Bytes_write_i32 = F4(function(mb, i, n, isLE) { mb.setInt32(i, n, isLE); return i + 4; });


// UNSIGNED INTEGERS

var _Bytes_write_u8  = F3(function(mb, i, n) { mb.setUint8(i, n); return i + 1 ;});
var _Bytes_write_u16 = F4(function(mb, i, n, isLE) { mb.setUint16(i, n, isLE); return i + 2; });
var _Bytes_write_u32 = F4(function(mb, i, n, isLE) { mb.setUint32(i, n, isLE); return i + 4; });


// FLOATS

var _Bytes_write_f32 = F4(function(mb, i, n, isLE) { mb.setFloat32(i, n, isLE); return i + 4; });
var _Bytes_write_f64 = F4(function(mb, i, n, isLE) { mb.setFloat64(i, n, isLE); return i + 8; });


// BYTES

var _Bytes_write_bytes = F3(function(mb, offset, bytes)
{
	for (var i = 0, len = bytes.byteLength, limit = len - 4; i <= limit; i += 4)
	{
		mb.setUint32(offset + i, bytes.getUint32(i));
	}
	for (; i < len; i++)
	{
		mb.setUint8(offset + i, bytes.getUint8(i));
	}
	return offset + len;
});


// STRINGS

function _Bytes_getStringWidth(string)
{
	for (var width = 0, i = 0; i < string.length; i++)
	{
		var code = string.charCodeAt(i);
		width +=
			(code < 0x80) ? 1 :
			(code < 0x800) ? 2 :
			(code < 0xD800 || 0xDBFF < code) ? 3 : (i++, 4);
	}
	return width;
}

var _Bytes_write_string = F3(function(mb, offset, string)
{
	for (var i = 0; i < string.length; i++)
	{
		var code = string.charCodeAt(i);
		offset +=
			(code < 0x80)
				? (mb.setUint8(offset, code)
				, 1
				)
				:
			(code < 0x800)
				? (mb.setUint16(offset, 0xC080 /* 0b1100000010000000 */
					| (code >>> 6 & 0x1F /* 0b00011111 */) << 8
					| code & 0x3F /* 0b00111111 */)
				, 2
				)
				:
			(code < 0xD800 || 0xDBFF < code)
				? (mb.setUint16(offset, 0xE080 /* 0b1110000010000000 */
					| (code >>> 12 & 0xF /* 0b00001111 */) << 8
					| code >>> 6 & 0x3F /* 0b00111111 */)
				, mb.setUint8(offset + 2, 0x80 /* 0b10000000 */
					| code & 0x3F /* 0b00111111 */)
				, 3
				)
				:
			(code = (code - 0xD800) * 0x400 + string.charCodeAt(++i) - 0xDC00 + 0x10000
			, mb.setUint32(offset, 0xF0808080 /* 0b11110000100000001000000010000000 */
				| (code >>> 18 & 0x7 /* 0b00000111 */) << 24
				| (code >>> 12 & 0x3F /* 0b00111111 */) << 16
				| (code >>> 6 & 0x3F /* 0b00111111 */) << 8
				| code & 0x3F /* 0b00111111 */)
			, 4
			);
	}
	return offset;
});


// DECODER

var _Bytes_decode = F2(function(decoder, bytes)
{
	try {
		return $elm$core$Maybe$Just(A2(decoder, bytes, 0).b);
	} catch(e) {
		return $elm$core$Maybe$Nothing;
	}
});

var _Bytes_read_i8  = F2(function(      bytes, offset) { return _Utils_Tuple2(offset + 1, bytes.getInt8(offset)); });
var _Bytes_read_i16 = F3(function(isLE, bytes, offset) { return _Utils_Tuple2(offset + 2, bytes.getInt16(offset, isLE)); });
var _Bytes_read_i32 = F3(function(isLE, bytes, offset) { return _Utils_Tuple2(offset + 4, bytes.getInt32(offset, isLE)); });
var _Bytes_read_u8  = F2(function(      bytes, offset) { return _Utils_Tuple2(offset + 1, bytes.getUint8(offset)); });
var _Bytes_read_u16 = F3(function(isLE, bytes, offset) { return _Utils_Tuple2(offset + 2, bytes.getUint16(offset, isLE)); });
var _Bytes_read_u32 = F3(function(isLE, bytes, offset) { return _Utils_Tuple2(offset + 4, bytes.getUint32(offset, isLE)); });
var _Bytes_read_f32 = F3(function(isLE, bytes, offset) { return _Utils_Tuple2(offset + 4, bytes.getFloat32(offset, isLE)); });
var _Bytes_read_f64 = F3(function(isLE, bytes, offset) { return _Utils_Tuple2(offset + 8, bytes.getFloat64(offset, isLE)); });

var _Bytes_read_bytes = F3(function(len, bytes, offset)
{
	return _Utils_Tuple2(offset + len, new DataView(bytes.buffer, bytes.byteOffset + offset, len));
});

var _Bytes_read_string = F3(function(len, bytes, offset)
{
	var string = '';
	var end = offset + len;
	for (; offset < end;)
	{
		var byte = bytes.getUint8(offset++);
		string +=
			(byte < 128)
				? String.fromCharCode(byte)
				:
			((byte & 0xE0 /* 0b11100000 */) === 0xC0 /* 0b11000000 */)
				? String.fromCharCode((byte & 0x1F /* 0b00011111 */) << 6 | bytes.getUint8(offset++) & 0x3F /* 0b00111111 */)
				:
			((byte & 0xF0 /* 0b11110000 */) === 0xE0 /* 0b11100000 */)
				? String.fromCharCode(
					(byte & 0xF /* 0b00001111 */) << 12
					| (bytes.getUint8(offset++) & 0x3F /* 0b00111111 */) << 6
					| bytes.getUint8(offset++) & 0x3F /* 0b00111111 */
				)
				:
				(byte =
					((byte & 0x7 /* 0b00000111 */) << 18
						| (bytes.getUint8(offset++) & 0x3F /* 0b00111111 */) << 12
						| (bytes.getUint8(offset++) & 0x3F /* 0b00111111 */) << 6
						| bytes.getUint8(offset++) & 0x3F /* 0b00111111 */
					) - 0x10000
				, String.fromCharCode(Math.floor(byte / 0x400) + 0xD800, byte % 0x400 + 0xDC00)
				);
	}
	return _Utils_Tuple2(offset, string);
});

var _Bytes_decodeFailure = F2(function() { throw 0; });



// SEND REQUEST

var _Http_toTask = F3(function(router, toTask, request)
{
	return _Scheduler_binding(function(callback)
	{
		function done(response) {
			callback(toTask(request.expect.a(response)));
		}

		var controller = new AbortController();
		var isAborted = false;

		// Timeout
		var timeoutMs = request.timeout.a || 0;
		var timeoutId = 0;
		if (timeoutMs > 0)
		{
			timeoutId = setTimeout(function() {
				isAborted = true;
				controller.abort();
				done($lynxjs_elm$http$Http$Timeout_);
			}, timeoutMs);
		}

		// Headers
		var headers = {};
		for (var h = request.headers; h.b; h = h.b) // WHILE_CONS
		{
			headers[h.a.a] = h.a.b;
		}
		if (request.body.a)
		{
			headers['Content-Type'] = request.body.a;
		}

		// Options
		var options = {
			method: request.method,
			headers: headers,
			signal: controller.signal
		};
		if (request.body.b)
		{
			options.body = request.body.b;
		}

		// Validate URL
		var url = request.url;
		try { new URL(url, 'http://localhost'); }
		catch (e) { return done($lynxjs_elm$http$Http$BadUrl_(url)); }

		// Fetch
		fetch(url, options).then(function(response)
		{
			var bodyPromise = request.expect.b === 'arraybuffer'
				? response.arrayBuffer()
				: response.text();

			return bodyPromise.then(function(body)
			{
				if (timeoutId) { clearTimeout(timeoutId); }

				var metadata = {
					url: response.url || url,
					statusCode: response.status,
					statusText: response.statusText,
					headers: _Http_parseHeaders(response.headers)
				};

				var toBody = request.expect.c;
				done(A2(
					200 <= response.status && response.status < 300 ? $lynxjs_elm$http$Http$GoodStatus_ : $lynxjs_elm$http$Http$BadStatus_,
					metadata,
					toBody(body)
				));
			});
		}).catch(function(e)
		{
			if (timeoutId) { clearTimeout(timeoutId); }
			if (!isAborted)
			{
				done($lynxjs_elm$http$Http$NetworkError_);
			}
		});

		// Tracker
		$elm$core$Maybe$isJust(request.tracker) && _Http_track(router, controller, request.tracker.a);

		return function() { isAborted = true; controller.abort(); };
	});
});


// HEADERS

function _Http_parseHeaders(headers)
{
	var dict = $elm$core$Dict$empty;
	headers.forEach(function(value, key)
	{
		dict = A3($elm$core$Dict$update, key, function(oldValue) {
			return $elm$core$Maybe$Just($elm$core$Maybe$isJust(oldValue)
				? value + ', ' + oldValue.a
				: value
			);
		}, dict);
	});
	return dict;
}


// EXPECT

var _Http_expect = F3(function(type, toBody, toValue)
{
	return {
		$: 0,
		b: type,
		c: toBody,
		a: toValue
	};
});

var _Http_mapExpect = F2(function(func, expect)
{
	return {
		$: 0,
		b: expect.b,
		c: expect.c,
		a: function(x) { return func(expect.a(x)); }
	};
});

function _Http_toDataView(arrayBuffer)
{
	return _Bytes_wrap(new DataView(arrayBuffer));
}


// BODY and PARTS

var _Http_emptyBody = { $: 0 };
var _Http_pair = F2(function(a, b) { return { $: 0, a: a, b: b }; });

function _Http_toFormData(parts)
{
	for (var formData = new FormData(); parts.b; parts = parts.b) // WHILE_CONS
	{
		var part = parts.a;
		formData.append(part.a, part.b);
	}
	return formData;
}

var _Http_bytesToBlob = F2(function(mime, bytes)
{
	return new Blob([bytes], { type: mime });
});


// PROGRESS

function _Http_track(router, controller, tracker)
{
	// fetch does not support upload/download progress events natively.
	// Progress subscriptions will not fire, but the tracker still enables
	// cancellation via Http.cancel.
}



// NOBLE/CURVES BUNDLE (https://github.com/paulmillr/noble-curves, MIT License)
// Embedded: @noble/curves 2.0.1 - secp256k1, ed25519, x25519, P-256

var _Crypto_noble=(()=>{var ie=Object.defineProperty;var Nn=Object.getOwnPropertyDescriptor;var Dn=Object.getOwnPropertyNames;var Zn=Object.prototype.hasOwnProperty;var Cn=(e,t)=>{for(var r in t)ie(e,r,{get:t[r],enumerable:!0})},Vn=(e,t,r,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of Dn(t))!Zn.call(e,o)&&o!==r&&ie(e,o,{get:()=>t[o],enumerable:!(n=Nn(t,o))||n.enumerable});return e};var Mn=e=>Vn(ie({},"a",{value:!0}),e);var Er={};Cn(Er,{bytesToHex:()=>nt,ed25519:()=>Ln,hexToBytes:()=>rt,p256:()=>qn,secp256k1:()=>Sn,x25519:()=>Un});function wt(e){return e instanceof Uint8Array||ArrayBuffer.isView(e)&&e.constructor.name==="Uint8Array"}function ot(e,t=""){if(!Number.isSafeInteger(e)||e<0){let r=t&&`"${t}" `;throw new Error(`${r}expected integer >= 0, got ${e}`)}}function N(e,t,r=""){let n=wt(e),o=e?.length,f=t!==void 0;if(!n||f&&o!==t){let i=r&&`"${r}" `,c=f?` of length ${t}`:"",s=n?`length=${o}`:`type=${typeof e}`;throw new Error(i+"expected Uint8Array"+c+", got "+s)}return e}function Wt(e){if(typeof e!="function"||typeof e.create!="function")throw new Error("Hash must wrapped by utils.createHasher");ot(e.outputLen),ot(e.blockLen)}function Rt(e,t=!0){if(e.destroyed)throw new Error("Hash instance has been destroyed");if(t&&e.finished)throw new Error("Hash#digest() has already been called")}function Ve(e,t){N(e,void 0,"digestInto() output");let r=t.outputLen;if(e.length<r)throw new Error('"digestInto() output" expected to be of length >='+r)}function at(...e){for(let t=0;t<e.length;t++)e[t].fill(0)}function $t(e){return new DataView(e.buffer,e.byteOffset,e.byteLength)}function et(e,t){return e<<32-t|e>>>t}var Me=typeof Uint8Array.from([]).toHex=="function"&&typeof Uint8Array.fromHex=="function",kn=Array.from({length:256},(e,t)=>t.toString(16).padStart(2,"0"));function nt(e){if(N(e),Me)return e.toHex();let t="";for(let r=0;r<e.length;r++)t+=kn[e[r]];return t}var ct={_0:48,_9:57,A:65,F:70,a:97,f:102};function Ce(e){if(e>=ct._0&&e<=ct._9)return e-ct._0;if(e>=ct.A&&e<=ct.F)return e-(ct.A-10);if(e>=ct.a&&e<=ct.f)return e-(ct.a-10)}function rt(e){if(typeof e!="string")throw new Error("hex string expected, got "+typeof e);if(Me)return Uint8Array.fromHex(e);let t=e.length,r=t/2;if(t%2)throw new Error("hex string expected, got unpadded hex of length "+t);let n=new Uint8Array(r);for(let o=0,f=0;o<r;o++,f+=2){let i=Ce(e.charCodeAt(f)),c=Ce(e.charCodeAt(f+1));if(i===void 0||c===void 0){let s=e[f]+e[f+1];throw new Error('hex string expected, got non-hex character "'+s+'" at index '+f)}n[o]=i*16+c}return n}function tt(...e){let t=0;for(let n=0;n<e.length;n++){let o=e[n];N(o),t+=o.length}let r=new Uint8Array(t);for(let n=0,o=0;n<e.length;n++){let f=e[n];r.set(f,o),o+=f.length}return r}function ce(e,t={}){let r=(o,f)=>e(f).update(o).digest(),n=e(void 0);return r.outputLen=n.outputLen,r.blockLen=n.blockLen,r.create=o=>e(o),Object.assign(r,t),Object.freeze(r)}function ht(e=32){let t=typeof globalThis=="object"?globalThis.crypto:null;if(typeof t?.getRandomValues!="function")throw new Error("crypto.getRandomValues must be defined");return t.getRandomValues(new Uint8Array(e))}var ae=e=>({oid:Uint8Array.from([6,9,96,134,72,1,101,3,4,2,e])});function ke(e,t,r){return e&t^~e&r}function Ye(e,t,r){return e&t^e&r^t&r}var Ct=class{blockLen;outputLen;padOffset;isLE;buffer;view;finished=!1;length=0;pos=0;destroyed=!1;constructor(t,r,n,o){this.blockLen=t,this.outputLen=r,this.padOffset=n,this.isLE=o,this.buffer=new Uint8Array(t),this.view=$t(this.buffer)}update(t){Rt(this),N(t);let{view:r,buffer:n,blockLen:o}=this,f=t.length;for(let i=0;i<f;){let c=Math.min(o-this.pos,f-i);if(c===o){let s=$t(t);for(;o<=f-i;i+=o)this.process(s,i);continue}n.set(t.subarray(i,i+c),this.pos),this.pos+=c,i+=c,this.pos===o&&(this.process(r,0),this.pos=0)}return this.length+=t.length,this.roundClean(),this}digestInto(t){Rt(this),Ve(t,this),this.finished=!0;let{buffer:r,view:n,blockLen:o,isLE:f}=this,{pos:i}=this;r[i++]=128,at(this.buffer.subarray(i)),this.padOffset>o-i&&(this.process(n,0),i=0);for(let x=i;x<o;x++)r[x]=0;n.setBigUint64(o-8,BigInt(this.length*8),f),this.process(n,0);let c=$t(t),s=this.outputLen;if(s%4)throw new Error("_sha2: outputLen must be aligned to 32bit");let l=s/4,h=this.get();if(l>h.length)throw new Error("_sha2: outputLen bigger than state");for(let x=0;x<l;x++)c.setUint32(4*x,h[x],f)}digest(){let{buffer:t,outputLen:r}=this;this.digestInto(t);let n=t.slice(0,r);return this.destroy(),n}_cloneInto(t){t||=new this.constructor,t.set(...this.get());let{blockLen:r,buffer:n,length:o,finished:f,destroyed:i,pos:c}=this;return t.destroyed=i,t.finished=f,t.length=o,t.pos=c,o%r&&t.buffer.set(n),t}clone(){return this._cloneInto()}},dt=Uint32Array.from([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]);var Q=Uint32Array.from([1779033703,4089235720,3144134277,2227873595,1013904242,4271175723,2773480762,1595750129,1359893119,2917565137,2600822924,725511199,528734635,4215389547,1541459225,327033209]);var Pt=BigInt(4294967295),Xe=BigInt(32);function Yn(e,t=!1){return t?{h:Number(e&Pt),l:Number(e>>Xe&Pt)}:{h:Number(e>>Xe&Pt)|0,l:Number(e&Pt)|0}}function Ge(e,t=!1){let r=e.length,n=new Uint32Array(r),o=new Uint32Array(r);for(let f=0;f<r;f++){let{h:i,l:c}=Yn(e[f],t);[n[f],o[f]]=[i,c]}return[n,o]}var de=(e,t,r)=>e>>>r,ue=(e,t,r)=>e<<32-r|t>>>r,Bt=(e,t,r)=>e>>>r|t<<32-r,Et=(e,t,r)=>e<<32-r|t>>>r,Vt=(e,t,r)=>e<<64-r|t>>>r-32,Mt=(e,t,r)=>e>>>r-32|t<<64-r;function ft(e,t,r,n){let o=(t>>>0)+(n>>>0);return{h:e+r+(o/2**32|0)|0,l:o|0}}var Ke=(e,t,r)=>(e>>>0)+(t>>>0)+(r>>>0),je=(e,t,r,n)=>t+r+n+(e/2**32|0)|0,ze=(e,t,r,n)=>(e>>>0)+(t>>>0)+(r>>>0)+(n>>>0),We=(e,t,r,n,o)=>t+r+n+o+(e/2**32|0)|0,$e=(e,t,r,n,o)=>(e>>>0)+(t>>>0)+(r>>>0)+(n>>>0)+(o>>>0),Pe=(e,t,r,n,o,f)=>t+r+n+o+f+(e/2**32|0)|0;var Gn=Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),bt=new Uint32Array(64),le=class extends Ct{constructor(t){super(64,t,8,!1)}get(){let{A:t,B:r,C:n,D:o,E:f,F:i,G:c,H:s}=this;return[t,r,n,o,f,i,c,s]}set(t,r,n,o,f,i,c,s){this.A=t|0,this.B=r|0,this.C=n|0,this.D=o|0,this.E=f|0,this.F=i|0,this.G=c|0,this.H=s|0}process(t,r){for(let x=0;x<16;x++,r+=4)bt[x]=t.getUint32(r,!1);for(let x=16;x<64;x++){let v=bt[x-15],E=bt[x-2],w=et(v,7)^et(v,18)^v>>>3,L=et(E,17)^et(E,19)^E>>>10;bt[x]=L+bt[x-7]+w+bt[x-16]|0}let{A:n,B:o,C:f,D:i,E:c,F:s,G:l,H:h}=this;for(let x=0;x<64;x++){let v=et(c,6)^et(c,11)^et(c,25),E=h+v+ke(c,s,l)+Gn[x]+bt[x]|0,L=(et(n,2)^et(n,13)^et(n,22))+Ye(n,o,f)|0;h=l,l=s,s=c,c=i+E|0,i=f,f=o,o=n,n=E+L|0}n=n+this.A|0,o=o+this.B|0,f=f+this.C|0,i=i+this.D|0,c=c+this.E|0,s=s+this.F|0,l=l+this.G|0,h=h+this.H|0,this.set(n,o,f,i,c,s,l,h)}roundClean(){at(bt)}destroy(){this.set(0,0,0,0,0,0,0,0),at(this.buffer)}},he=class extends le{A=dt[0]|0;B=dt[1]|0;C=dt[2]|0;D=dt[3]|0;E=dt[4]|0;F=dt[5]|0;G=dt[6]|0;H=dt[7]|0;constructor(){super(32)}};var Qe=Ge(["0x428a2f98d728ae22","0x7137449123ef65cd","0xb5c0fbcfec4d3b2f","0xe9b5dba58189dbbc","0x3956c25bf348b538","0x59f111f1b605d019","0x923f82a4af194f9b","0xab1c5ed5da6d8118","0xd807aa98a3030242","0x12835b0145706fbe","0x243185be4ee4b28c","0x550c7dc3d5ffb4e2","0x72be5d74f27b896f","0x80deb1fe3b1696b1","0x9bdc06a725c71235","0xc19bf174cf692694","0xe49b69c19ef14ad2","0xefbe4786384f25e3","0x0fc19dc68b8cd5b5","0x240ca1cc77ac9c65","0x2de92c6f592b0275","0x4a7484aa6ea6e483","0x5cb0a9dcbd41fbd4","0x76f988da831153b5","0x983e5152ee66dfab","0xa831c66d2db43210","0xb00327c898fb213f","0xbf597fc7beef0ee4","0xc6e00bf33da88fc2","0xd5a79147930aa725","0x06ca6351e003826f","0x142929670a0e6e70","0x27b70a8546d22ffc","0x2e1b21385c26c926","0x4d2c6dfc5ac42aed","0x53380d139d95b3df","0x650a73548baf63de","0x766a0abb3c77b2a8","0x81c2c92e47edaee6","0x92722c851482353b","0xa2bfe8a14cf10364","0xa81a664bbc423001","0xc24b8b70d0f89791","0xc76c51a30654be30","0xd192e819d6ef5218","0xd69906245565a910","0xf40e35855771202a","0x106aa07032bbd1b8","0x19a4c116b8d2d0c8","0x1e376c085141ab53","0x2748774cdf8eeb99","0x34b0bcb5e19b48a8","0x391c0cb3c5c95a63","0x4ed8aa4ae3418acb","0x5b9cca4f7763e373","0x682e6ff3d6b2b8a3","0x748f82ee5defb2fc","0x78a5636f43172f60","0x84c87814a1f0ab72","0x8cc702081a6439ec","0x90befffa23631e28","0xa4506cebde82bde9","0xbef9a3f7b2c67915","0xc67178f2e372532b","0xca273eceea26619c","0xd186b8c721c0c207","0xeada7dd6cde0eb1e","0xf57d4f7fee6ed178","0x06f067aa72176fba","0x0a637dc5a2c898a6","0x113f9804bef90dae","0x1b710b35131c471b","0x28db77f523047d84","0x32caab7b40c72493","0x3c9ebe0a15c9bebc","0x431d67c49c100d4c","0x4cc5d4becb3e42b6","0x597f299cfc657e2a","0x5fcb6fab3ad6faec","0x6c44198c4a475817"].map(e=>BigInt(e))),Kn=Qe[0],jn=Qe[1],xt=new Uint32Array(80),mt=new Uint32Array(80),be=class extends Ct{constructor(t){super(128,t,16,!1)}get(){let{Ah:t,Al:r,Bh:n,Bl:o,Ch:f,Cl:i,Dh:c,Dl:s,Eh:l,El:h,Fh:x,Fl:v,Gh:E,Gl:w,Hh:L,Hl:y}=this;return[t,r,n,o,f,i,c,s,l,h,x,v,E,w,L,y]}set(t,r,n,o,f,i,c,s,l,h,x,v,E,w,L,y){this.Ah=t|0,this.Al=r|0,this.Bh=n|0,this.Bl=o|0,this.Ch=f|0,this.Cl=i|0,this.Dh=c|0,this.Dl=s|0,this.Eh=l|0,this.El=h|0,this.Fh=x|0,this.Fl=v|0,this.Gh=E|0,this.Gl=w|0,this.Hh=L|0,this.Hl=y|0}process(t,r){for(let p=0;p<16;p++,r+=4)xt[p]=t.getUint32(r),mt[p]=t.getUint32(r+=4);for(let p=16;p<80;p++){let T=xt[p-15]|0,D=mt[p-15]|0,V=Bt(T,D,1)^Bt(T,D,8)^de(T,D,7),k=Et(T,D,1)^Et(T,D,8)^ue(T,D,7),B=xt[p-2]|0,b=mt[p-2]|0,q=Bt(B,b,19)^Vt(B,b,61)^de(B,b,6),Z=Et(B,b,19)^Mt(B,b,61)^ue(B,b,6),O=ze(k,Z,mt[p-7],mt[p-16]),u=We(O,V,q,xt[p-7],xt[p-16]);xt[p]=u|0,mt[p]=O|0}let{Ah:n,Al:o,Bh:f,Bl:i,Ch:c,Cl:s,Dh:l,Dl:h,Eh:x,El:v,Fh:E,Fl:w,Gh:L,Gl:y,Hh:g,Hl:R}=this;for(let p=0;p<80;p++){let T=Bt(x,v,14)^Bt(x,v,18)^Vt(x,v,41),D=Et(x,v,14)^Et(x,v,18)^Mt(x,v,41),V=x&E^~x&L,k=v&w^~v&y,B=$e(R,D,k,jn[p],mt[p]),b=Pe(B,g,T,V,Kn[p],xt[p]),q=B|0,Z=Bt(n,o,28)^Vt(n,o,34)^Vt(n,o,39),O=Et(n,o,28)^Mt(n,o,34)^Mt(n,o,39),u=n&f^n&c^f&c,a=o&i^o&s^i&s;g=L|0,R=y|0,L=E|0,y=w|0,E=x|0,w=v|0,{h:x,l:v}=ft(l|0,h|0,b|0,q|0),l=c|0,h=s|0,c=f|0,s=i|0,f=n|0,i=o|0;let d=Ke(q,O,a);n=je(d,b,Z,u),o=d|0}({h:n,l:o}=ft(this.Ah|0,this.Al|0,n|0,o|0)),{h:f,l:i}=ft(this.Bh|0,this.Bl|0,f|0,i|0),{h:c,l:s}=ft(this.Ch|0,this.Cl|0,c|0,s|0),{h:l,l:h}=ft(this.Dh|0,this.Dl|0,l|0,h|0),{h:x,l:v}=ft(this.Eh|0,this.El|0,x|0,v|0),{h:E,l:w}=ft(this.Fh|0,this.Fl|0,E|0,w|0),{h:L,l:y}=ft(this.Gh|0,this.Gl|0,L|0,y|0),{h:g,l:R}=ft(this.Hh|0,this.Hl|0,g|0,R|0),this.set(n,o,f,i,c,s,l,h,x,v,E,w,L,y,g,R)}roundClean(){at(xt,mt)}destroy(){at(this.buffer),this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)}},xe=class extends be{Ah=Q[0]|0;Al=Q[1]|0;Bh=Q[2]|0;Bl=Q[3]|0;Ch=Q[4]|0;Cl=Q[5]|0;Dh=Q[6]|0;Dl=Q[7]|0;Eh=Q[8]|0;El=Q[9]|0;Fh=Q[10]|0;Fl=Q[11]|0;Gh=Q[12]|0;Gl=Q[13]|0;Hh=Q[14]|0;Hl=Q[15]|0;constructor(){super(64)}};var Qt=ce(()=>new he,ae(1));var me=ce(()=>new xe,ae(3));var pe=BigInt(0),ge=BigInt(1);function ut(e,t=""){if(typeof e!="boolean"){let r=t&&`"${t}" `;throw new Error(r+"expected boolean, got type="+typeof e)}return e}function Je(e){if(typeof e=="bigint"){if(!Jt(e))throw new Error("positive bigint expected, got "+e)}else ot(e);return e}function kt(e){let t=Je(e).toString(16);return t.length&1?"0"+t:t}function Fe(e){if(typeof e!="string")throw new Error("hex string expected, got "+typeof e);return e===""?pe:BigInt("0x"+e)}function Ot(e){return Fe(nt(e))}function st(e){return Fe(nt(vt(N(e)).reverse()))}function Ft(e,t){ot(t),e=Je(e);let r=rt(e.toString(16).padStart(t*2,"0"));if(r.length!==t)throw new Error("number too large");return r}function Yt(e,t){return Ft(e,t).reverse()}function vt(e){return Uint8Array.from(e)}var Jt=e=>typeof e=="bigint"&&pe<=e;function zn(e,t,r){return Jt(e)&&Jt(t)&&Jt(r)&&t<=e&&e<r}function gt(e,t,r,n){if(!zn(t,r,n))throw new Error("expected valid "+e+": "+r+" <= n < "+n+", got "+t)}function ye(e){let t;for(t=0;e>pe;e>>=ge,t+=1);return t}var Xt=e=>(ge<<BigInt(e))-ge;function tn(e,t,r){if(ot(e,"hashLen"),ot(t,"qByteLen"),typeof r!="function")throw new Error("hmacFn must be a function");let n=y=>new Uint8Array(y),o=Uint8Array.of(),f=Uint8Array.of(0),i=Uint8Array.of(1),c=1e3,s=n(e),l=n(e),h=0,x=()=>{s.fill(1),l.fill(0),h=0},v=(...y)=>r(l,tt(s,...y)),E=(y=o)=>{l=v(f,y),s=v(),y.length!==0&&(l=v(i,y),s=v())},w=()=>{if(h++>=c)throw new Error("drbg: tried max amount of iterations");let y=0,g=[];for(;y<t;){s=v();let R=s.slice();g.push(R),y+=s.length}return tt(...g)};return(y,g)=>{x(),E(y);let R;for(;!(R=g(w()));)E();return x(),R}}function it(e,t={},r={}){if(!e||typeof e!="object")throw new Error("expected valid options object");function n(f,i,c){let s=e[f];if(c&&s===void 0)return;let l=typeof s;if(l!==i||s===null)throw new Error(`param "${f}" is invalid: expected ${i}, got ${l}`)}let o=(f,i)=>Object.entries(f).forEach(([c,s])=>n(c,s,i));o(t,!1),o(r,!0)}function Ht(e){let t=new WeakMap;return(r,...n)=>{let o=t.get(r);if(o!==void 0)return o;let f=e(r,...n);return t.set(r,f),f}}var J=BigInt(0),$=BigInt(1),St=BigInt(2),rn=BigInt(3),on=BigInt(4),fn=BigInt(5),Wn=BigInt(7),sn=BigInt(8),$n=BigInt(9),cn=BigInt(16);function j(e,t){let r=e%t;return r>=J?r:t+r}function G(e,t,r){let n=e;for(;t-- >J;)n*=n,n%=r;return n}function en(e,t){if(e===J)throw new Error("invert: expected non-zero number");if(t<=J)throw new Error("invert: expected positive modulus, got "+t);let r=j(e,t),n=t,o=J,f=$,i=$,c=J;for(;r!==J;){let l=n/r,h=n%r,x=o-i*l,v=f-c*l;n=r,r=h,o=i,f=c,i=x,c=v}if(n!==$)throw new Error("invert: does not exist");return j(o,t)}function Be(e,t,r){if(!e.eql(e.sqr(t),r))throw new Error("Cannot find square root")}function an(e,t){let r=(e.ORDER+$)/on,n=e.pow(t,r);return Be(e,n,t),n}function Pn(e,t){let r=(e.ORDER-fn)/sn,n=e.mul(t,St),o=e.pow(n,r),f=e.mul(t,o),i=e.mul(e.mul(f,St),o),c=e.mul(f,e.sub(i,e.ONE));return Be(e,c,t),c}function Qn(e){let t=Tt(e),r=dn(e),n=r(t,t.neg(t.ONE)),o=r(t,n),f=r(t,t.neg(n)),i=(e+Wn)/cn;return(c,s)=>{let l=c.pow(s,i),h=c.mul(l,n),x=c.mul(l,o),v=c.mul(l,f),E=c.eql(c.sqr(h),s),w=c.eql(c.sqr(x),s);l=c.cmov(l,h,E),h=c.cmov(v,x,w);let L=c.eql(c.sqr(h),s),y=c.cmov(l,h,L);return Be(c,y,s),y}}function dn(e){if(e<rn)throw new Error("sqrt is not defined for small field");let t=e-$,r=0;for(;t%St===J;)t/=St,r++;let n=St,o=Tt(e);for(;nn(o,n)===1;)if(n++>1e3)throw new Error("Cannot find square root: probably non-prime P");if(r===1)return an;let f=o.pow(n,t),i=(t+$)/St;return function(s,l){if(s.is0(l))return l;if(nn(s,l)!==1)throw new Error("Cannot find square root");let h=r,x=s.mul(s.ONE,f),v=s.pow(l,t),E=s.pow(l,i);for(;!s.eql(v,s.ONE);){if(s.is0(v))return s.ZERO;let w=1,L=s.sqr(v);for(;!s.eql(L,s.ONE);)if(w++,L=s.sqr(L),w===h)throw new Error("Cannot find square root");let y=$<<BigInt(h-w-1),g=s.pow(x,y);h=w,x=s.sqr(g),v=s.mul(v,x),E=s.mul(E,g)}return E}}function Jn(e){return e%on===rn?an:e%sn===fn?Pn:e%cn===$n?Qn(e):dn(e)}var un=(e,t)=>(j(e,t)&$)===$,Fn=["create","isValid","is0","neg","inv","sqrt","sqr","eql","add","sub","mul","pow","div","addN","subN","mulN","sqrN"];function Ee(e){let t={ORDER:"bigint",BYTES:"number",BITS:"number"},r=Fn.reduce((n,o)=>(n[o]="function",n),t);return it(e,r),e}function tr(e,t,r){if(r<J)throw new Error("invalid exponent, negatives unsupported");if(r===J)return e.ONE;if(r===$)return t;let n=e.ONE,o=t;for(;r>J;)r&$&&(n=e.mul(n,o)),o=e.sqr(o),r>>=$;return n}function Gt(e,t,r=!1){let n=new Array(t.length).fill(r?e.ZERO:void 0),o=t.reduce((i,c,s)=>e.is0(c)?i:(n[s]=i,e.mul(i,c)),e.ONE),f=e.inv(o);return t.reduceRight((i,c,s)=>e.is0(c)?i:(n[s]=e.mul(i,n[s]),e.mul(i,c)),f),n}function nn(e,t){let r=(e.ORDER-$)/St,n=e.pow(t,r),o=e.eql(n,e.ONE),f=e.eql(n,e.ZERO),i=e.eql(n,e.neg(e.ONE));if(!o&&!f&&!i)throw new Error("invalid Legendre symbol result");return o?1:f?0:-1}function er(e,t){t!==void 0&&ot(t);let r=t!==void 0?t:e.toString(2).length,n=Math.ceil(r/8);return{nBitLength:r,nByteLength:n}}var we=class{ORDER;BITS;BYTES;isLE;ZERO=J;ONE=$;_lengths;_sqrt;_mod;constructor(t,r={}){if(t<=J)throw new Error("invalid field: expected ORDER > 0, got "+t);let n;this.isLE=!1,r!=null&&typeof r=="object"&&(typeof r.BITS=="number"&&(n=r.BITS),typeof r.sqrt=="function"&&(this.sqrt=r.sqrt),typeof r.isLE=="boolean"&&(this.isLE=r.isLE),r.allowedLengths&&(this._lengths=r.allowedLengths?.slice()),typeof r.modFromBytes=="boolean"&&(this._mod=r.modFromBytes));let{nBitLength:o,nByteLength:f}=er(t,n);if(f>2048)throw new Error("invalid field: expected ORDER of <= 2048 bytes");this.ORDER=t,this.BITS=o,this.BYTES=f,this._sqrt=void 0,Object.preventExtensions(this)}create(t){return j(t,this.ORDER)}isValid(t){if(typeof t!="bigint")throw new Error("invalid field element: expected bigint, got "+typeof t);return J<=t&&t<this.ORDER}is0(t){return t===J}isValidNot0(t){return!this.is0(t)&&this.isValid(t)}isOdd(t){return(t&$)===$}neg(t){return j(-t,this.ORDER)}eql(t,r){return t===r}sqr(t){return j(t*t,this.ORDER)}add(t,r){return j(t+r,this.ORDER)}sub(t,r){return j(t-r,this.ORDER)}mul(t,r){return j(t*r,this.ORDER)}pow(t,r){return tr(this,t,r)}div(t,r){return j(t*en(r,this.ORDER),this.ORDER)}sqrN(t){return t*t}addN(t,r){return t+r}subN(t,r){return t-r}mulN(t,r){return t*r}inv(t){return en(t,this.ORDER)}sqrt(t){return this._sqrt||(this._sqrt=Jn(this.ORDER)),this._sqrt(this,t)}toBytes(t){return this.isLE?Yt(t,this.BYTES):Ft(t,this.BYTES)}fromBytes(t,r=!1){N(t);let{_lengths:n,BYTES:o,isLE:f,ORDER:i,_mod:c}=this;if(n){if(!n.includes(t.length)||t.length>o)throw new Error("Field.fromBytes: expected "+n+" bytes, got "+t.length);let l=new Uint8Array(o);l.set(t,f?0:l.length-t.length),t=l}if(t.length!==o)throw new Error("Field.fromBytes: expected "+o+" bytes, got "+t.length);let s=f?st(t):Ot(t);if(c&&(s=j(s,i)),!r&&!this.isValid(s))throw new Error("invalid field element: outside of range 0..ORDER");return s}invertBatch(t){return Gt(this,t)}cmov(t,r,n){return n?r:t}};function Tt(e,t={}){return new we(e,t)}function ln(e){if(typeof e!="bigint")throw new Error("field order must be bigint");let t=e.toString(2).length;return Math.ceil(t/8)}function ve(e){let t=ln(e);return t+Math.ceil(t/2)}function Se(e,t,r=!1){N(e);let n=e.length,o=ln(t),f=ve(t);if(n<16||n<f||n>1024)throw new Error("expected "+f+"-1024 bytes of input, got "+n);let i=r?st(e):Ot(e),c=j(i,t-$)+$;return r?Yt(c,o):Ft(c,o)}var Lt=BigInt(0),_t=BigInt(1);function Kt(e,t){let r=t.negate();return e?r:t}function It(e,t){let r=Gt(e.Fp,t.map(n=>n.Z));return t.map((n,o)=>e.fromAffine(n.toAffine(r[o])))}function mn(e,t){if(!Number.isSafeInteger(e)||e<=0||e>t)throw new Error("invalid window size, expected [1.."+t+"], got W="+e)}function _e(e,t){mn(e,t);let r=Math.ceil(t/e)+1,n=2**(e-1),o=2**e,f=Xt(e),i=BigInt(e);return{windows:r,windowSize:n,mask:f,maxNumber:o,shiftBy:i}}function hn(e,t,r){let{windowSize:n,mask:o,maxNumber:f,shiftBy:i}=r,c=Number(e&o),s=e>>i;c>n&&(c-=f,s+=_t);let l=t*n,h=l+Math.abs(c)-1,x=c===0,v=c<0,E=t%2!==0;return{nextN:s,offset:h,isZero:x,isNeg:v,isNegF:E,offsetF:l}}var Ie=new WeakMap,gn=new WeakMap;function Ae(e){return gn.get(e)||1}function bn(e){if(e!==Lt)throw new Error("invalid wNAF")}var Ut=class{BASE;ZERO;Fn;bits;constructor(t,r){this.BASE=t.BASE,this.ZERO=t.ZERO,this.Fn=t.Fn,this.bits=r}_unsafeLadder(t,r,n=this.ZERO){let o=t;for(;r>Lt;)r&_t&&(n=n.add(o)),o=o.double(),r>>=_t;return n}precomputeWindow(t,r){let{windows:n,windowSize:o}=_e(r,this.bits),f=[],i=t,c=i;for(let s=0;s<n;s++){c=i,f.push(c);for(let l=1;l<o;l++)c=c.add(i),f.push(c);i=c.double()}return f}wNAF(t,r,n){if(!this.Fn.isValid(n))throw new Error("invalid scalar");let o=this.ZERO,f=this.BASE,i=_e(t,this.bits);for(let c=0;c<i.windows;c++){let{nextN:s,offset:l,isZero:h,isNeg:x,isNegF:v,offsetF:E}=hn(n,c,i);n=s,h?f=f.add(Kt(v,r[E])):o=o.add(Kt(x,r[l]))}return bn(n),{p:o,f}}wNAFUnsafe(t,r,n,o=this.ZERO){let f=_e(t,this.bits);for(let i=0;i<f.windows&&n!==Lt;i++){let{nextN:c,offset:s,isZero:l,isNeg:h}=hn(n,i,f);if(n=c,!l){let x=r[s];o=o.add(h?x.negate():x)}}return bn(n),o}getPrecomputes(t,r,n){let o=Ie.get(r);return o||(o=this.precomputeWindow(r,t),t!==1&&(typeof n=="function"&&(o=n(o)),Ie.set(r,o))),o}cached(t,r,n){let o=Ae(t);return this.wNAF(o,this.getPrecomputes(o,t,n),r)}unsafe(t,r,n,o){let f=Ae(t);return f===1?this._unsafeLadder(t,r,o):this.wNAFUnsafe(f,this.getPrecomputes(f,t,n),r,o)}createCache(t,r){mn(r,this.bits),gn.set(t,r),Ie.delete(t)}hasCache(t){return Ae(t)!==1}};function pn(e,t,r,n){let o=t,f=e.ZERO,i=e.ZERO;for(;r>Lt||n>Lt;)r&_t&&(f=f.add(o)),n&_t&&(i=i.add(o)),o=o.double(),r>>=_t,n>>=_t;return{p1:f,p2:i}}function xn(e,t,r){if(t){if(t.ORDER!==e)throw new Error("Field.ORDER must match order: Fp == p, Fn == n");return Ee(t),t}else return Tt(e,{isLE:r})}function te(e,t,r={},n){if(n===void 0&&(n=e==="edwards"),!t||typeof t!="object")throw new Error(`expected valid ${e} CURVE object`);for(let s of["p","n","h"]){let l=t[s];if(!(typeof l=="bigint"&&l>Lt))throw new Error(`CURVE.${s} must be positive bigint`)}let o=xn(t.p,r.Fp,n),f=xn(t.n,r.Fn,n),c=["Gx","Gy","a",e==="weierstrass"?"b":"d"];for(let s of c)if(!o.isValid(t[s]))throw new Error(`CURVE.${s} must be valid field element of CURVE.Fp`);return t=Object.freeze(Object.assign({},t)),{CURVE:t,Fp:o,Fn:f}}function qt(e,t){return function(n){let o=e(n);return{secretKey:o,publicKey:t(o)}}}var ee=class{oHash;iHash;blockLen;outputLen;finished=!1;destroyed=!1;constructor(t,r){if(Wt(t),N(r,void 0,"key"),this.iHash=t.create(),typeof this.iHash.update!="function")throw new Error("Expected instance of class which extends utils.Hash");this.blockLen=this.iHash.blockLen,this.outputLen=this.iHash.outputLen;let n=this.blockLen,o=new Uint8Array(n);o.set(r.length>n?t.create().update(r).digest():r);for(let f=0;f<o.length;f++)o[f]^=54;this.iHash.update(o),this.oHash=t.create();for(let f=0;f<o.length;f++)o[f]^=106;this.oHash.update(o),at(o)}update(t){return Rt(this),this.iHash.update(t),this}digestInto(t){Rt(this),N(t,this.outputLen,"output"),this.finished=!0,this.iHash.digestInto(t),this.oHash.update(t),this.oHash.digestInto(t),this.destroy()}digest(){let t=new Uint8Array(this.oHash.outputLen);return this.digestInto(t),t}_cloneInto(t){t||=Object.create(Object.getPrototypeOf(this),{});let{oHash:r,iHash:n,finished:o,destroyed:f,blockLen:i,outputLen:c}=this;return t=t,t.finished=o,t.destroyed=f,t.blockLen=i,t.outputLen=c,t.oHash=r._cloneInto(t.oHash),t.iHash=n._cloneInto(t.iHash),t}clone(){return this._cloneInto()}destroy(){this.destroyed=!0,this.oHash.destroy(),this.iHash.destroy()}},Re=(e,t,r)=>new ee(e,t).update(r).digest();Re.create=(e,t)=>new ee(e,t);var yn=(e,t)=>(e+(e>=0?t:-t)/wn)/t;function nr(e,t,r){let[[n,o],[f,i]]=t,c=yn(i*e,r),s=yn(-o*e,r),l=e-c*n-s*f,h=-c*o-s*i,x=l<lt,v=h<lt;x&&(l=-l),v&&(h=-h);let E=Xt(Math.ceil(ye(r)/2))+Nt;if(l<lt||l>=E||h<lt||h>=E)throw new Error("splitScalar (endomorphism): failed, k="+e);return{k1neg:x,k1:l,k2neg:v,k2:h}}function He(e){if(!["compact","recovered","der"].includes(e))throw new Error('Signature format must be "compact", "recovered", or "der"');return e}function Oe(e,t){let r={};for(let n of Object.keys(t))r[n]=e[n]===void 0?t[n]:e[n];return ut(r.lowS,"lowS"),ut(r.prehash,"prehash"),r.format!==void 0&&He(r.format),r}var Te=class extends Error{constructor(t=""){super(t)}},pt={Err:Te,_tlv:{encode:(e,t)=>{let{Err:r}=pt;if(e<0||e>256)throw new r("tlv.encode: wrong tag");if(t.length&1)throw new r("tlv.encode: unpadded data");let n=t.length/2,o=kt(n);if(o.length/2&128)throw new r("tlv.encode: long form length too big");let f=n>127?kt(o.length/2|128):"";return kt(e)+f+o+t},decode(e,t){let{Err:r}=pt,n=0;if(e<0||e>256)throw new r("tlv.encode: wrong tag");if(t.length<2||t[n++]!==e)throw new r("tlv.decode: wrong tlv");let o=t[n++],f=!!(o&128),i=0;if(!f)i=o;else{let s=o&127;if(!s)throw new r("tlv.decode(long): indefinite length not supported");if(s>4)throw new r("tlv.decode(long): byte length is too big");let l=t.subarray(n,n+s);if(l.length!==s)throw new r("tlv.decode: length bytes not complete");if(l[0]===0)throw new r("tlv.decode(long): zero leftmost byte");for(let h of l)i=i<<8|h;if(n+=s,i<128)throw new r("tlv.decode(long): not minimal encoding")}let c=t.subarray(n,n+i);if(c.length!==i)throw new r("tlv.decode: wrong value length");return{v:c,l:t.subarray(n+i)}}},_int:{encode(e){let{Err:t}=pt;if(e<lt)throw new t("integer: negative integers are not allowed");let r=kt(e);if(Number.parseInt(r[0],16)&8&&(r="00"+r),r.length&1)throw new t("unexpected DER parsing assertion: unpadded hex");return r},decode(e){let{Err:t}=pt;if(e[0]&128)throw new t("invalid signature integer: negative");if(e[0]===0&&!(e[1]&128))throw new t("invalid signature integer: unnecessary leading zero");return Ot(e)}},toSig(e){let{Err:t,_int:r,_tlv:n}=pt,o=N(e,void 0,"signature"),{v:f,l:i}=n.decode(48,o);if(i.length)throw new t("invalid signature: left bytes after parsing");let{v:c,l:s}=n.decode(2,f),{v:l,l:h}=n.decode(2,s);if(h.length)throw new t("invalid signature: left bytes after parsing");return{r:r.decode(c),s:r.decode(l)}},hexFromSig(e){let{_tlv:t,_int:r}=pt,n=t.encode(2,r.encode(e.r)),o=t.encode(2,r.encode(e.s)),f=n+o;return t.encode(48,f)}},lt=BigInt(0),Nt=BigInt(1),wn=BigInt(2),ne=BigInt(3),rr=BigInt(4);function re(e,t={}){let r=te("weierstrass",e,t),{Fp:n,Fn:o}=r,f=r.CURVE,{h:i,n:c}=f;it(t,{},{allowInfinityPoint:"boolean",clearCofactor:"function",isTorsionFree:"function",fromBytes:"function",toBytes:"function",endo:"object"});let{endo:s}=t;if(s&&(!n.is0(f.a)||typeof s.beta!="bigint"||!Array.isArray(s.basises)))throw new Error('invalid endo: expected "beta": bigint and "basises": array');let l=En(n,o);function h(){if(!n.isOdd)throw new Error("compression is not supported: Field does not have .isOdd()")}function x(O,u,a){let{x:d,y:m}=u.toAffine(),I=n.toBytes(d);if(ut(a,"isCompressed"),a){h();let S=!n.isOdd(m);return tt(Bn(S),I)}else return tt(Uint8Array.of(4),I,n.toBytes(m))}function v(O){N(O,void 0,"Point");let{publicKey:u,publicKeyUncompressed:a}=l,d=O.length,m=O[0],I=O.subarray(1);if(d===u&&(m===2||m===3)){let S=n.fromBytes(I);if(!n.isValid(S))throw new Error("bad point: is not on curve, wrong x");let A=L(S),_;try{_=n.sqrt(A)}catch(K){let M=K instanceof Error?": "+K.message:"";throw new Error("bad point: is not on curve, sqrt error"+M)}h();let H=n.isOdd(_);return(m&1)===1!==H&&(_=n.neg(_)),{x:S,y:_}}else if(d===a&&m===4){let S=n.BYTES,A=n.fromBytes(I.subarray(0,S)),_=n.fromBytes(I.subarray(S,S*2));if(!y(A,_))throw new Error("bad point: is not on curve");return{x:A,y:_}}else throw new Error(`bad point: got length ${d}, expected compressed=${u} or uncompressed=${a}`)}let E=t.toBytes||x,w=t.fromBytes||v;function L(O){let u=n.sqr(O),a=n.mul(u,O);return n.add(n.add(a,n.mul(O,f.a)),f.b)}function y(O,u){let a=n.sqr(u),d=L(O);return n.eql(a,d)}if(!y(f.Gx,f.Gy))throw new Error("bad curve params: generator point");let g=n.mul(n.pow(f.a,ne),rr),R=n.mul(n.sqr(f.b),BigInt(27));if(n.is0(n.add(g,R)))throw new Error("bad curve params: a or b");function p(O,u,a=!1){if(!n.isValid(u)||a&&n.is0(u))throw new Error(`bad point coordinate ${O}`);return u}function T(O){if(!(O instanceof b))throw new Error("Weierstrass Point expected")}function D(O){if(!s||!s.basises)throw new Error("no endo");return nr(O,s.basises,o.ORDER)}let V=Ht((O,u)=>{let{X:a,Y:d,Z:m}=O;if(n.eql(m,n.ONE))return{x:a,y:d};let I=O.is0();u==null&&(u=I?n.ONE:n.inv(m));let S=n.mul(a,u),A=n.mul(d,u),_=n.mul(m,u);if(I)return{x:n.ZERO,y:n.ZERO};if(!n.eql(_,n.ONE))throw new Error("invZ was invalid");return{x:S,y:A}}),k=Ht(O=>{if(O.is0()){if(t.allowInfinityPoint&&!n.is0(O.Y))return;throw new Error("bad point: ZERO")}let{x:u,y:a}=O.toAffine();if(!n.isValid(u)||!n.isValid(a))throw new Error("bad point: x or y not field elements");if(!y(u,a))throw new Error("bad point: equation left != right");if(!O.isTorsionFree())throw new Error("bad point: not in prime-order subgroup");return!0});function B(O,u,a,d,m){return a=new b(n.mul(a.X,O),a.Y,a.Z),u=Kt(d,u),a=Kt(m,a),u.add(a)}class b{static BASE=new b(f.Gx,f.Gy,n.ONE);static ZERO=new b(n.ZERO,n.ONE,n.ZERO);static Fp=n;static Fn=o;X;Y;Z;constructor(u,a,d){this.X=p("x",u),this.Y=p("y",a,!0),this.Z=p("z",d),Object.freeze(this)}static CURVE(){return f}static fromAffine(u){let{x:a,y:d}=u||{};if(!u||!n.isValid(a)||!n.isValid(d))throw new Error("invalid affine point");if(u instanceof b)throw new Error("projective point not allowed");return n.is0(a)&&n.is0(d)?b.ZERO:new b(a,d,n.ONE)}static fromBytes(u){let a=b.fromAffine(w(N(u,void 0,"point")));return a.assertValidity(),a}static fromHex(u){return b.fromBytes(rt(u))}get x(){return this.toAffine().x}get y(){return this.toAffine().y}precompute(u=8,a=!0){return Z.createCache(this,u),a||this.multiply(ne),this}assertValidity(){k(this)}hasEvenY(){let{y:u}=this.toAffine();if(!n.isOdd)throw new Error("Field doesn't support isOdd");return!n.isOdd(u)}equals(u){T(u);let{X:a,Y:d,Z:m}=this,{X:I,Y:S,Z:A}=u,_=n.eql(n.mul(a,A),n.mul(I,m)),H=n.eql(n.mul(d,A),n.mul(S,m));return _&&H}negate(){return new b(this.X,n.neg(this.Y),this.Z)}double(){let{a:u,b:a}=f,d=n.mul(a,ne),{X:m,Y:I,Z:S}=this,A=n.ZERO,_=n.ZERO,H=n.ZERO,U=n.mul(m,m),K=n.mul(I,I),M=n.mul(S,S),C=n.mul(m,I);return C=n.add(C,C),H=n.mul(m,S),H=n.add(H,H),A=n.mul(u,H),_=n.mul(d,M),_=n.add(A,_),A=n.sub(K,_),_=n.add(K,_),_=n.mul(A,_),A=n.mul(C,A),H=n.mul(d,H),M=n.mul(u,M),C=n.sub(U,M),C=n.mul(u,C),C=n.add(C,H),H=n.add(U,U),U=n.add(H,U),U=n.add(U,M),U=n.mul(U,C),_=n.add(_,U),M=n.mul(I,S),M=n.add(M,M),U=n.mul(M,C),A=n.sub(A,U),H=n.mul(M,K),H=n.add(H,H),H=n.add(H,H),new b(A,_,H)}add(u){T(u);let{X:a,Y:d,Z:m}=this,{X:I,Y:S,Z:A}=u,_=n.ZERO,H=n.ZERO,U=n.ZERO,K=f.a,M=n.mul(f.b,ne),C=n.mul(a,I),Y=n.mul(d,S),z=n.mul(m,A),F=n.add(a,d),X=n.add(I,S);F=n.mul(F,X),X=n.add(C,Y),F=n.sub(F,X),X=n.add(a,m);let W=n.add(I,A);return X=n.mul(X,W),W=n.add(C,z),X=n.sub(X,W),W=n.add(d,m),_=n.add(S,A),W=n.mul(W,_),_=n.add(Y,z),W=n.sub(W,_),U=n.mul(K,X),_=n.mul(M,z),U=n.add(_,U),_=n.sub(Y,U),U=n.add(Y,U),H=n.mul(_,U),Y=n.add(C,C),Y=n.add(Y,C),z=n.mul(K,z),X=n.mul(M,X),Y=n.add(Y,z),z=n.sub(C,z),z=n.mul(K,z),X=n.add(X,z),C=n.mul(Y,X),H=n.add(H,C),C=n.mul(W,X),_=n.mul(F,_),_=n.sub(_,C),C=n.mul(F,Y),U=n.mul(W,U),U=n.add(U,C),new b(_,H,U)}subtract(u){return this.add(u.negate())}is0(){return this.equals(b.ZERO)}multiply(u){let{endo:a}=t;if(!o.isValidNot0(u))throw new Error("invalid scalar: out of range");let d,m,I=S=>Z.cached(this,S,A=>It(b,A));if(a){let{k1neg:S,k1:A,k2neg:_,k2:H}=D(u),{p:U,f:K}=I(A),{p:M,f:C}=I(H);m=K.add(C),d=B(a.beta,U,M,S,_)}else{let{p:S,f:A}=I(u);d=S,m=A}return It(b,[d,m])[0]}multiplyUnsafe(u){let{endo:a}=t,d=this;if(!o.isValid(u))throw new Error("invalid scalar: out of range");if(u===lt||d.is0())return b.ZERO;if(u===Nt)return d;if(Z.hasCache(this))return this.multiply(u);if(a){let{k1neg:m,k1:I,k2neg:S,k2:A}=D(u),{p1:_,p2:H}=pn(b,d,I,A);return B(a.beta,_,H,m,S)}else return Z.unsafe(d,u)}toAffine(u){return V(this,u)}isTorsionFree(){let{isTorsionFree:u}=t;return i===Nt?!0:u?u(b,this):Z.unsafe(this,c).is0()}clearCofactor(){let{clearCofactor:u}=t;return i===Nt?this:u?u(b,this):this.multiplyUnsafe(i)}isSmallOrder(){return this.multiplyUnsafe(i).is0()}toBytes(u=!0){return ut(u,"isCompressed"),this.assertValidity(),E(b,this,u)}toHex(u=!0){return nt(this.toBytes(u))}toString(){return`<Point ${this.is0()?"ZERO":this.toHex()}>`}}let q=o.BITS,Z=new Ut(b,t.endo?Math.ceil(q/2):q);return b.BASE.precompute(8),b}function Bn(e){return Uint8Array.of(e?2:3)}function En(e,t){return{secretKey:t.BYTES,publicKey:1+e.BYTES,publicKeyUncompressed:1+2*e.BYTES,publicKeyHasPrefix:!0,signature:2*t.BYTES}}function or(e,t={}){let{Fn:r}=e,n=t.randomBytes||ht,o=Object.assign(En(e.Fp,r),{seed:ve(r.ORDER)});function f(E){try{let w=r.fromBytes(E);return r.isValidNot0(w)}catch{return!1}}function i(E,w){let{publicKey:L,publicKeyUncompressed:y}=o;try{let g=E.length;return w===!0&&g!==L||w===!1&&g!==y?!1:!!e.fromBytes(E)}catch{return!1}}function c(E=n(o.seed)){return Se(N(E,o.seed,"seed"),r.ORDER)}function s(E,w=!0){return e.BASE.multiply(r.fromBytes(E)).toBytes(w)}function l(E){let{secretKey:w,publicKey:L,publicKeyUncompressed:y}=o;if(!wt(E)||"_lengths"in r&&r._lengths||w===L)return;let g=N(E,void 0,"key").length;return g===L||g===y}function h(E,w,L=!0){if(l(E)===!0)throw new Error("first arg must be private key");if(l(w)===!1)throw new Error("second arg must be public key");let y=r.fromBytes(E);return e.fromBytes(w).multiply(y).toBytes(L)}let x={isValidSecretKey:f,isValidPublicKey:i,randomSecretKey:c},v=qt(c,s);return Object.freeze({getPublicKey:s,getSharedSecret:h,keygen:v,Point:e,utils:x,lengths:o})}function oe(e,t,r={}){Wt(t),it(r,{},{hmac:"function",lowS:"boolean",randomBytes:"function",bits2int:"function",bits2int_modN:"function"}),r=Object.assign({},r);let n=r.randomBytes||ht,o=r.hmac||((a,d)=>Re(t,a,d)),{Fp:f,Fn:i}=e,{ORDER:c,BITS:s}=i,{keygen:l,getPublicKey:h,getSharedSecret:x,utils:v,lengths:E}=or(e,r),w={prehash:!0,lowS:typeof r.lowS=="boolean"?r.lowS:!0,format:"compact",extraEntropy:!1},L=c*wn<f.ORDER;function y(a){let d=c>>Nt;return a>d}function g(a,d){if(!i.isValidNot0(d))throw new Error(`invalid signature ${a}: out of range 1..Point.Fn.ORDER`);return d}function R(){if(L)throw new Error('"recovered" sig type is not supported for cofactor >2 curves')}function p(a,d){He(d);let m=E.signature,I=d==="compact"?m:d==="recovered"?m+1:void 0;return N(a,I)}class T{r;s;recovery;constructor(d,m,I){if(this.r=g("r",d),this.s=g("s",m),I!=null){if(R(),![0,1,2,3].includes(I))throw new Error("invalid recovery id");this.recovery=I}Object.freeze(this)}static fromBytes(d,m=w.format){p(d,m);let I;if(m==="der"){let{r:H,s:U}=pt.toSig(N(d));return new T(H,U)}m==="recovered"&&(I=d[0],m="compact",d=d.subarray(1));let S=E.signature/2,A=d.subarray(0,S),_=d.subarray(S,S*2);return new T(i.fromBytes(A),i.fromBytes(_),I)}static fromHex(d,m){return this.fromBytes(rt(d),m)}assertRecovery(){let{recovery:d}=this;if(d==null)throw new Error("invalid recovery id: must be present");return d}addRecoveryBit(d){return new T(this.r,this.s,d)}recoverPublicKey(d){let{r:m,s:I}=this,S=this.assertRecovery(),A=S===2||S===3?m+c:m;if(!f.isValid(A))throw new Error("invalid recovery id: sig.r+curve.n != R.x");let _=f.toBytes(A),H=e.fromBytes(tt(Bn((S&1)===0),_)),U=i.inv(A),K=V(N(d,void 0,"msgHash")),M=i.create(-K*U),C=i.create(I*U),Y=e.BASE.multiplyUnsafe(M).add(H.multiplyUnsafe(C));if(Y.is0())throw new Error("invalid recovery: point at infinify");return Y.assertValidity(),Y}hasHighS(){return y(this.s)}toBytes(d=w.format){if(He(d),d==="der")return rt(pt.hexFromSig(this));let{r:m,s:I}=this,S=i.toBytes(m),A=i.toBytes(I);return d==="recovered"?(R(),tt(Uint8Array.of(this.assertRecovery()),S,A)):tt(S,A)}toHex(d){return nt(this.toBytes(d))}}let D=r.bits2int||function(d){if(d.length>8192)throw new Error("input is too large");let m=Ot(d),I=d.length*8-s;return I>0?m>>BigInt(I):m},V=r.bits2int_modN||function(d){return i.create(D(d))},k=Xt(s);function B(a){return gt("num < 2^"+s,a,lt,k),i.toBytes(a)}function b(a,d){return N(a,void 0,"message"),d?N(t(a),void 0,"prehashed message"):a}function q(a,d,m){let{lowS:I,prehash:S,extraEntropy:A}=Oe(m,w);a=b(a,S);let _=V(a),H=i.fromBytes(d);if(!i.isValidNot0(H))throw new Error("invalid private key");let U=[B(H),B(_)];if(A!=null&&A!==!1){let Y=A===!0?n(E.secretKey):A;U.push(N(Y,void 0,"extraEntropy"))}let K=tt(...U),M=_;function C(Y){let z=D(Y);if(!i.isValidNot0(z))return;let F=i.inv(z),X=e.BASE.multiply(z).toAffine(),W=i.create(X.x);if(W===lt)return;let At=i.create(F*i.create(M+W*H));if(At===lt)return;let zt=(X.x===W?0:2)|Number(X.y&Nt),Zt=At;return I&&y(At)&&(Zt=i.neg(At),zt^=1),new T(W,Zt,L?void 0:zt)}return{seed:K,k2sig:C}}function Z(a,d,m={}){let{seed:I,k2sig:S}=q(a,d,m);return tn(t.outputLen,i.BYTES,o)(I,S).toBytes(m.format)}function O(a,d,m,I={}){let{lowS:S,prehash:A,format:_}=Oe(I,w);if(m=N(m,void 0,"publicKey"),d=b(d,A),!wt(a)){let H=a instanceof T?", use sig.toBytes()":"";throw new Error("verify expects Uint8Array signature"+H)}p(a,_);try{let H=T.fromBytes(a,_),U=e.fromBytes(m);if(S&&H.hasHighS())return!1;let{r:K,s:M}=H,C=V(d),Y=i.inv(M),z=i.create(C*Y),F=i.create(K*Y),X=e.BASE.multiplyUnsafe(z).add(U.multiplyUnsafe(F));return X.is0()?!1:i.create(X.x)===K}catch{return!1}}function u(a,d,m={}){let{prehash:I}=Oe(m,w);return d=b(d,I),T.fromBytes(a,"recovered").recoverPublicKey(d).toBytes()}return Object.freeze({keygen:l,getPublicKey:h,getSharedSecret:x,utils:v,lengths:E,Point:e,sign:Z,verify:O,recoverPublicKey:u,Signature:T,hash:t})}var Ue={p:BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),n:BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),h:BigInt(1),a:BigInt(0),b:BigInt(7),Gx:BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),Gy:BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")},sr={beta:BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),basises:[[BigInt("0x3086d221a7d46bcde86c90e49284eb15"),-BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],[BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"),BigInt("0x3086d221a7d46bcde86c90e49284eb15")]]};var vn=BigInt(2);function ir(e){let t=Ue.p,r=BigInt(3),n=BigInt(6),o=BigInt(11),f=BigInt(22),i=BigInt(23),c=BigInt(44),s=BigInt(88),l=e*e*e%t,h=l*l*e%t,x=G(h,r,t)*h%t,v=G(x,r,t)*h%t,E=G(v,vn,t)*l%t,w=G(E,o,t)*E%t,L=G(w,f,t)*w%t,y=G(L,c,t)*L%t,g=G(y,s,t)*y%t,R=G(g,c,t)*L%t,p=G(R,r,t)*h%t,T=G(p,i,t)*w%t,D=G(T,n,t)*l%t,V=G(D,vn,t);if(!Le.eql(Le.sqr(V),e))throw new Error("Cannot find square root");return V}var Le=Tt(Ue.p,{sqrt:ir}),cr=re(Ue,{Fp:Le,endo:sr}),Sn=oe(cr,Qt);var yt=BigInt(0),P=BigInt(1),qe=BigInt(2),ar=BigInt(8);function dr(e,t,r,n){let o=e.sqr(r),f=e.sqr(n),i=e.add(e.mul(t.a,o),f),c=e.add(e.ONE,e.mul(t.d,e.mul(o,f)));return e.eql(i,c)}function _n(e,t={}){let r=te("edwards",e,t,t.FpFnLE),{Fp:n,Fn:o}=r,f=r.CURVE,{h:i}=f;it(t,{},{uvRatio:"function"});let c=qe<<BigInt(o.BYTES*8)-P,s=y=>n.create(y),l=t.uvRatio||((y,g)=>{try{return{isValid:!0,value:n.sqrt(n.div(y,g))}}catch{return{isValid:!1,value:yt}}});if(!dr(n,f,f.Gx,f.Gy))throw new Error("bad curve params: generator point");function h(y,g,R=!1){let p=R?P:yt;return gt("coordinate "+y,g,p,c),g}function x(y){if(!(y instanceof w))throw new Error("EdwardsPoint expected")}let v=Ht((y,g)=>{let{X:R,Y:p,Z:T}=y,D=y.is0();g==null&&(g=D?ar:n.inv(T));let V=s(R*g),k=s(p*g),B=n.mul(T,g);if(D)return{x:yt,y:P};if(B!==P)throw new Error("invZ was invalid");return{x:V,y:k}}),E=Ht(y=>{let{a:g,d:R}=f;if(y.is0())throw new Error("bad point: ZERO");let{X:p,Y:T,Z:D,T:V}=y,k=s(p*p),B=s(T*T),b=s(D*D),q=s(b*b),Z=s(k*g),O=s(b*s(Z+B)),u=s(q+s(R*s(k*B)));if(O!==u)throw new Error("bad point: equation left != right (1)");let a=s(p*T),d=s(D*V);if(a!==d)throw new Error("bad point: equation left != right (2)");return!0});class w{static BASE=new w(f.Gx,f.Gy,P,s(f.Gx*f.Gy));static ZERO=new w(yt,P,P,yt);static Fp=n;static Fn=o;X;Y;Z;T;constructor(g,R,p,T){this.X=h("x",g),this.Y=h("y",R),this.Z=h("z",p,!0),this.T=h("t",T),Object.freeze(this)}static CURVE(){return f}static fromAffine(g){if(g instanceof w)throw new Error("extended point not allowed");let{x:R,y:p}=g||{};return h("x",R),h("y",p),new w(R,p,P,s(R*p))}static fromBytes(g,R=!1){let p=n.BYTES,{a:T,d:D}=f;g=vt(N(g,p,"point")),ut(R,"zip215");let V=vt(g),k=g[p-1];V[p-1]=k&-129;let B=st(V),b=R?c:n.ORDER;gt("point.y",B,yt,b);let q=s(B*B),Z=s(q-P),O=s(D*q-T),{isValid:u,value:a}=l(Z,O);if(!u)throw new Error("bad point: invalid y coordinate");let d=(a&P)===P,m=(k&128)!==0;if(!R&&a===yt&&m)throw new Error("bad point: x=0 and x_0=1");return m!==d&&(a=s(-a)),w.fromAffine({x:a,y:B})}static fromHex(g,R=!1){return w.fromBytes(rt(g),R)}get x(){return this.toAffine().x}get y(){return this.toAffine().y}precompute(g=8,R=!0){return L.createCache(this,g),R||this.multiply(qe),this}assertValidity(){E(this)}equals(g){x(g);let{X:R,Y:p,Z:T}=this,{X:D,Y:V,Z:k}=g,B=s(R*k),b=s(D*T),q=s(p*k),Z=s(V*T);return B===b&&q===Z}is0(){return this.equals(w.ZERO)}negate(){return new w(s(-this.X),this.Y,this.Z,s(-this.T))}double(){let{a:g}=f,{X:R,Y:p,Z:T}=this,D=s(R*R),V=s(p*p),k=s(qe*s(T*T)),B=s(g*D),b=R+p,q=s(s(b*b)-D-V),Z=B+V,O=Z-k,u=B-V,a=s(q*O),d=s(Z*u),m=s(q*u),I=s(O*Z);return new w(a,d,I,m)}add(g){x(g);let{a:R,d:p}=f,{X:T,Y:D,Z:V,T:k}=this,{X:B,Y:b,Z:q,T:Z}=g,O=s(T*B),u=s(D*b),a=s(k*p*Z),d=s(V*q),m=s((T+D)*(B+b)-O-u),I=d-a,S=d+a,A=s(u-R*O),_=s(m*I),H=s(S*A),U=s(m*A),K=s(I*S);return new w(_,H,K,U)}subtract(g){return this.add(g.negate())}multiply(g){if(!o.isValidNot0(g))throw new Error("invalid scalar: expected 1 <= sc < curve.n");let{p:R,f:p}=L.cached(this,g,T=>It(w,T));return It(w,[R,p])[0]}multiplyUnsafe(g,R=w.ZERO){if(!o.isValid(g))throw new Error("invalid scalar: expected 0 <= sc < curve.n");return g===yt?w.ZERO:this.is0()||g===P?this:L.unsafe(this,g,p=>It(w,p),R)}isSmallOrder(){return this.multiplyUnsafe(i).is0()}isTorsionFree(){return L.unsafe(this,f.n).is0()}toAffine(g){return v(this,g)}clearCofactor(){return i===P?this:this.multiplyUnsafe(i)}toBytes(){let{x:g,y:R}=this.toAffine(),p=n.toBytes(R);return p[p.length-1]|=g&P?128:0,p}toHex(){return nt(this.toBytes())}toString(){return`<Point ${this.is0()?"ZERO":this.toHex()}>`}}let L=new Ut(w,o.BITS);return w.BASE.precompute(8),w}function In(e,t,r={}){if(typeof t!="function")throw new Error('"hash" function param is required');it(r,{},{adjustScalarBytes:"function",randomBytes:"function",domain:"function",prehash:"function",mapToCurve:"function"});let{prehash:n}=r,{BASE:o,Fp:f,Fn:i}=e,c=r.randomBytes||ht,s=r.adjustScalarBytes||(B=>B),l=r.domain||((B,b,q)=>{if(ut(q,"phflag"),b.length||q)throw new Error("Contexts/pre-hash are not supported");return B});function h(B){return i.create(st(B))}function x(B){let b=p.secretKey;N(B,p.secretKey,"secretKey");let q=N(t(B),2*b,"hashedSecretKey"),Z=s(q.slice(0,b)),O=q.slice(b,2*b),u=h(Z);return{head:Z,prefix:O,scalar:u}}function v(B){let{head:b,prefix:q,scalar:Z}=x(B),O=o.multiply(Z),u=O.toBytes();return{head:b,prefix:q,scalar:Z,point:O,pointBytes:u}}function E(B){return v(B).pointBytes}function w(B=Uint8Array.of(),...b){let q=tt(...b);return h(t(l(q,N(B,void 0,"context"),!!n)))}function L(B,b,q={}){B=N(B,void 0,"message"),n&&(B=n(B));let{prefix:Z,scalar:O,pointBytes:u}=v(b),a=w(q.context,Z,B),d=o.multiply(a).toBytes(),m=w(q.context,d,u,B),I=i.create(a+m*O);if(!i.isValid(I))throw new Error("sign failed: invalid s");let S=tt(d,i.toBytes(I));return N(S,p.signature,"result")}let y={zip215:!0};function g(B,b,q,Z=y){let{context:O,zip215:u}=Z,a=p.signature;B=N(B,a,"signature"),b=N(b,void 0,"message"),q=N(q,p.publicKey,"publicKey"),u!==void 0&&ut(u,"zip215"),n&&(b=n(b));let d=a/2,m=B.subarray(0,d),I=st(B.subarray(d,a)),S,A,_;try{S=e.fromBytes(q,u),A=e.fromBytes(m,u),_=o.multiplyUnsafe(I)}catch{return!1}if(!u&&S.isSmallOrder())return!1;let H=w(O,A.toBytes(),S.toBytes(),b);return A.add(S.multiplyUnsafe(H)).subtract(_).clearCofactor().is0()}let R=f.BYTES,p={secretKey:R,publicKey:R,signature:2*R,seed:R};function T(B=c(p.seed)){return N(B,p.seed,"seed")}function D(B){return wt(B)&&B.length===i.BYTES}function V(B,b){try{return!!e.fromBytes(B,b)}catch{return!1}}let k={getExtendedPublicKey:v,randomSecretKey:T,isValidSecretKey:D,isValidPublicKey:V,toMontgomery(B){let{y:b}=e.fromBytes(B),q=p.publicKey,Z=q===32;if(!Z&&q!==57)throw new Error("only defined for 25519 and 448");let O=Z?f.div(P+b,P-b):f.div(b-P,b+P);return f.toBytes(O)},toMontgomerySecret(B){let b=p.secretKey;N(B,b);let q=t(B.subarray(0,b));return s(q).subarray(0,b)}};return Object.freeze({keygen:qt(T,E),getPublicKey:E,sign:L,verify:g,utils:k,Point:e,lengths:p})}var jt=BigInt(0),Dt=BigInt(1),fe=BigInt(2);function ur(e){return it(e,{adjustScalarBytes:"function",powPminus2:"function"}),Object.freeze({...e})}function An(e){let t=ur(e),{P:r,type:n,adjustScalarBytes:o,powPminus2:f,randomBytes:i}=t,c=n==="x25519";if(!c&&n!=="x448")throw new Error("invalid type");let s=i||ht,l=c?255:448,h=c?32:56,x=BigInt(c?9:5),v=BigInt(c?121665:39081),E=c?fe**BigInt(254):fe**BigInt(447),w=c?BigInt(8)*fe**BigInt(251)-Dt:BigInt(4)*fe**BigInt(445)-Dt,L=E+w+Dt,y=a=>j(a,r),g=R(x);function R(a){return Yt(y(a),h)}function p(a){let d=vt(N(a,h,"uCoordinate"));return c&&(d[31]&=127),y(st(d))}function T(a){return st(o(vt(N(a,h,"scalar"))))}function D(a,d){let m=q(p(d),T(a));if(m===jt)throw new Error("invalid private or public key received");return R(m)}function V(a){return D(a,g)}let k=V,B=D;function b(a,d,m){let I=y(a*(d-m));return d=y(d-I),m=y(m+I),{x_2:d,x_3:m}}function q(a,d){gt("u",a,jt,r),gt("scalar",d,E,L);let m=d,I=a,S=Dt,A=jt,_=a,H=Dt,U=jt;for(let M=BigInt(l-1);M>=jt;M--){let C=m>>M&Dt;U^=C,{x_2:S,x_3:_}=b(U,S,_),{x_2:A,x_3:H}=b(U,A,H),U=C;let Y=S+A,z=y(Y*Y),F=S-A,X=y(F*F),W=z-X,At=_+H,zt=_-H,Zt=y(zt*Y),Ne=y(At*F),De=Zt+Ne,Ze=Zt-Ne;_=y(De*De),H=y(I*y(Ze*Ze)),S=y(z*X),A=y(W*(z+y(v*W)))}({x_2:S,x_3:_}=b(U,S,_)),{x_2:A,x_3:H}=b(U,A,H);let K=f(A);return y(S*K)}let Z={secretKey:h,publicKey:h,seed:h},O=(a=s(h))=>(N(a,Z.seed,"seed"),a),u={randomSecretKey:O};return Object.freeze({keygen:qt(O,k),getSharedSecret:B,getPublicKey:k,scalarMult:D,scalarMultBase:V,utils:u,GuBytes:g.slice(),lengths:Z})}var lr=BigInt(1),Rn=BigInt(2),hr=BigInt(3),br=BigInt(5),xr=BigInt(8),se=BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed"),mr={p:se,n:BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),h:xr,a:BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),d:BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),Gx:BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),Gy:BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")};function Hn(e){let t=BigInt(10),r=BigInt(20),n=BigInt(40),o=BigInt(80),f=se,c=e*e%f*e%f,s=G(c,Rn,f)*c%f,l=G(s,lr,f)*e%f,h=G(l,br,f)*l%f,x=G(h,t,f)*h%f,v=G(x,r,f)*x%f,E=G(v,n,f)*v%f,w=G(E,o,f)*E%f,L=G(w,o,f)*E%f,y=G(L,t,f)*h%f;return{pow_p_5_8:G(y,Rn,f)*e%f,b2:c}}function Tn(e){return e[0]&=248,e[31]&=127,e[31]|=64,e}var On=BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");function gr(e,t){let r=se,n=j(t*t*t,r),o=j(n*n*t,r),f=Hn(e*o).pow_p_5_8,i=j(e*n*f,r),c=j(t*i*i,r),s=i,l=j(i*On,r),h=c===e,x=c===j(-e,r),v=c===j(-e*On,r);return h&&(i=s),(x||v)&&(i=l),un(i,r)&&(i=j(-i,r)),{isValid:h||x,value:i}}var pr=_n(mr,{uvRatio:gr});function yr(e){return In(pr,me,Object.assign({adjustScalarBytes:Tn},e))}var Ln=yr({});var Un=(()=>{let e=se;return An({P:e,type:"x25519",powPminus2:t=>{let{pow_p_5_8:r,b2:n}=Hn(t);return j(G(r,hr,e)*n,e)},adjustScalarBytes:Tn})})();var wr={p:BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),n:BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),h:BigInt(1),a:BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),b:BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),Gx:BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),Gy:BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")};var Br=re(wr),qn=oe(Br,Qt);return Mn(Er);})();
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/weierstrass.js:
@noble/curves/secp256k1.js:
@noble/curves/abstract/edwards.js:
@noble/curves/abstract/montgomery.js:
@noble/curves/ed25519.js:
@noble/curves/nist.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/weierstrass.js:
@noble/curves/secp256k1.js:
@noble/curves/abstract/edwards.js:
@noble/curves/abstract/montgomery.js:
@noble/curves/ed25519.js:
@noble/curves/nist.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/weierstrass.js:
@noble/curves/secp256k1.js:
@noble/curves/abstract/edwards.js:
@noble/curves/abstract/montgomery.js:
@noble/curves/ed25519.js:
@noble/curves/nist.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/weierstrass.js:
@noble/curves/secp256k1.js:
@noble/curves/abstract/edwards.js:
@noble/curves/ed25519.js:
@noble/curves/nist.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/


// UTILS

var _Crypto_toHex = _Crypto_noble.bytesToHex;
var _Crypto_fromHex = _Crypto_noble.hexToBytes;


// DER CODEC (for ECDSA signatures: secp256k1, P-256)

function _Crypto_bigintToBytes(n, len)
{
	var hex = n.toString(16);
	if (hex.length % 2) { hex = '0' + hex; }
	while (hex.length < len * 2) { hex = '00' + hex; }
	return _Crypto_fromHex(hex);
}

function _Crypto_bytesToBigint(bytes)
{
	return BigInt('0x' + _Crypto_toHex(bytes));
}

function _Crypto_compactToDer(compactHex, byteLen)
{
	var bytes = _Crypto_fromHex(compactHex);
	var r = bytes.slice(0, byteLen);
	var s = bytes.slice(byteLen);
	function encodeInt(b) {
		// Strip leading zeros, then add back if high bit set
		var i = 0;
		while (i < b.length - 1 && b[i] === 0) { i++; }
		b = b.slice(i);
		if (b[0] & 0x80) {
			var padded = new Uint8Array(b.length + 1);
			padded[0] = 0;
			padded.set(b, 1);
			b = padded;
		}
		return b;
	}
	var rEnc = encodeInt(r);
	var sEnc = encodeInt(s);
	var totalLen = 2 + rEnc.length + 2 + sEnc.length;
	var der = new Uint8Array(2 + totalLen);
	var pos = 0;
	der[pos++] = 0x30;
	der[pos++] = totalLen;
	der[pos++] = 0x02;
	der[pos++] = rEnc.length;
	der.set(rEnc, pos); pos += rEnc.length;
	der[pos++] = 0x02;
	der[pos++] = sEnc.length;
	der.set(sEnc, pos);
	return _Crypto_toHex(der);
}

function _Crypto_derToCompact(derHex, byteLen)
{
	var der = _Crypto_fromHex(derHex);
	if (der[0] !== 0x30) { return null; }
	var pos = 2;
	if (der[pos] !== 0x02) { return null; }
	var rLen = der[pos + 1]; pos += 2;
	var rBytes = der.slice(pos, pos + rLen); pos += rLen;
	if (der[pos] !== 0x02) { return null; }
	var sLen = der[pos + 1]; pos += 2;
	var sBytes = der.slice(pos, pos + sLen);
	// Remove leading zero padding
	while (rBytes.length > byteLen) { rBytes = rBytes.slice(1); }
	while (sBytes.length > byteLen) { sBytes = sBytes.slice(1); }
	// Pad to fixed width
	var r = new Uint8Array(byteLen);
	var s = new Uint8Array(byteLen);
	r.set(rBytes, byteLen - rBytes.length);
	s.set(sBytes, byteLen - sBytes.length);
	var compact = new Uint8Array(byteLen * 2);
	compact.set(r, 0);
	compact.set(s, byteLen);
	return _Crypto_toHex(compact);
}


// SECP256K1

function _Crypto_secp256k1PrivateKeyFromHex(hex)
{
	try {
		_Crypto_noble.secp256k1.getPublicKey(_Crypto_fromHex(hex));
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_secp256k1PrivateKeyToHex(key)
{
	return key;
}

function _Crypto_secp256k1PublicKeyFromHex(hex)
{
	try {
		_Crypto_noble.secp256k1.Point.fromHex(hex);
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_secp256k1PublicKeyToHex(key)
{
	return key;
}

function _Crypto_secp256k1SignatureFromCompactHex(hex)
{
	try {
		var bytes = _Crypto_fromHex(hex);
		if (bytes.length !== 64) { return $elm$core$Maybe$Nothing; }
		_Crypto_noble.secp256k1.Signature.fromHex(hex);
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_secp256k1SignatureFromDerHex(hex)
{
	try {
		var compact = _Crypto_derToCompact(hex, 32);
		if (!compact) { return $elm$core$Maybe$Nothing; }
		_Crypto_noble.secp256k1.Signature.fromHex(compact);
		return $elm$core$Maybe$Just(compact);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_secp256k1SignatureToCompactHex(sig)
{
	return sig;
}

function _Crypto_secp256k1SignatureToDerHex(compactHex)
{
	return _Crypto_compactToDer(compactHex, 32);
}

function _Crypto_secp256k1GetPublicKey(privKey)
{
	return _Crypto_toHex(_Crypto_noble.secp256k1.getPublicKey(_Crypto_fromHex(privKey)));
}

var _Crypto_secp256k1Sign = F2(function(msgHash, privKey)
{
	var sig = _Crypto_noble.secp256k1.sign(_Crypto_fromHex(msgHash), _Crypto_fromHex(privKey));
	return _Crypto_toHex(sig);
});

var _Crypto_secp256k1Verify = F3(function(sig, msgHash, pubKey)
{
	try {
		return _Crypto_noble.secp256k1.verify(
			_Crypto_fromHex(sig),
			_Crypto_fromHex(msgHash),
			_Crypto_fromHex(pubKey)
		);
	} catch (e) {
		return false;
	}
});

var _Crypto_secp256k1GetSharedSecret = F2(function(privKey, pubKey)
{
	return _Crypto_toHex(_Crypto_noble.secp256k1.getSharedSecret(_Crypto_fromHex(privKey), _Crypto_fromHex(pubKey)));
});


// ED25519

function _Crypto_ed25519PrivateKeyFromHex(hex)
{
	try {
		_Crypto_noble.ed25519.getPublicKey(_Crypto_fromHex(hex));
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_ed25519PrivateKeyToHex(key)
{
	return key;
}

function _Crypto_ed25519PublicKeyFromHex(hex)
{
	try {
		_Crypto_noble.ed25519.Point.fromHex(hex);
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_ed25519PublicKeyToHex(key)
{
	return key;
}

function _Crypto_ed25519SignatureFromHex(hex)
{
	try {
		var bytes = _Crypto_fromHex(hex);
		if (bytes.length !== 64) { return $elm$core$Maybe$Nothing; }
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_ed25519SignatureToHex(sig)
{
	return sig;
}

function _Crypto_ed25519GetPublicKey(privKey)
{
	return _Crypto_toHex(_Crypto_noble.ed25519.getPublicKey(_Crypto_fromHex(privKey)));
}

var _Crypto_ed25519Sign = F2(function(msg, privKey)
{
	return _Crypto_toHex(_Crypto_noble.ed25519.sign(_Crypto_fromHex(msg), _Crypto_fromHex(privKey)));
});

var _Crypto_ed25519Verify = F3(function(sig, msg, pubKey)
{
	try {
		return _Crypto_noble.ed25519.verify(
			_Crypto_fromHex(sig),
			_Crypto_fromHex(msg),
			_Crypto_fromHex(pubKey)
		);
	} catch (e) {
		return false;
	}
});


// X25519 (Diffie-Hellman)

function _Crypto_x25519PrivateKeyFromHex(hex)
{
	try {
		var bytes = _Crypto_fromHex(hex);
		if (bytes.length !== 32) { return $elm$core$Maybe$Nothing; }
		_Crypto_noble.x25519.getPublicKey(bytes);
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_x25519PrivateKeyToHex(key)
{
	return key;
}

function _Crypto_x25519PublicKeyFromHex(hex)
{
	try {
		var bytes = _Crypto_fromHex(hex);
		if (bytes.length !== 32) { return $elm$core$Maybe$Nothing; }
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_x25519PublicKeyToHex(key)
{
	return key;
}

function _Crypto_x25519GetPublicKey(privKey)
{
	return _Crypto_toHex(_Crypto_noble.x25519.getPublicKey(_Crypto_fromHex(privKey)));
}

var _Crypto_x25519GetSharedSecret = F2(function(privKey, pubKey)
{
	return _Crypto_toHex(_Crypto_noble.x25519.getSharedSecret(_Crypto_fromHex(privKey), _Crypto_fromHex(pubKey)));
});


// P-256 (secp256r1)

function _Crypto_p256PrivateKeyFromHex(hex)
{
	try {
		_Crypto_noble.p256.getPublicKey(_Crypto_fromHex(hex));
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_p256PrivateKeyToHex(key)
{
	return key;
}

function _Crypto_p256PublicKeyFromHex(hex)
{
	try {
		_Crypto_noble.p256.Point.fromHex(hex);
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_p256PublicKeyToHex(key)
{
	return key;
}

function _Crypto_p256SignatureFromCompactHex(hex)
{
	try {
		var bytes = _Crypto_fromHex(hex);
		if (bytes.length !== 64) { return $elm$core$Maybe$Nothing; }
		_Crypto_noble.p256.Signature.fromHex(hex);
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_p256SignatureFromDerHex(hex)
{
	try {
		var compact = _Crypto_derToCompact(hex, 32);
		if (!compact) { return $elm$core$Maybe$Nothing; }
		_Crypto_noble.p256.Signature.fromHex(compact);
		return $elm$core$Maybe$Just(compact);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_p256SignatureToCompactHex(sig)
{
	return sig;
}

function _Crypto_p256SignatureToDerHex(compactHex)
{
	return _Crypto_compactToDer(compactHex, 32);
}

function _Crypto_p256GetPublicKey(privKey)
{
	return _Crypto_toHex(_Crypto_noble.p256.getPublicKey(_Crypto_fromHex(privKey)));
}

var _Crypto_p256Sign = F2(function(msgHash, privKey)
{
	var sig = _Crypto_noble.p256.sign(_Crypto_fromHex(msgHash), _Crypto_fromHex(privKey));
	return _Crypto_toHex(sig);
});

var _Crypto_p256Verify = F3(function(sig, msgHash, pubKey)
{
	try {
		return _Crypto_noble.p256.verify(
			_Crypto_fromHex(sig),
			_Crypto_fromHex(msgHash),
			_Crypto_fromHex(pubKey)
		);
	} catch (e) {
		return false;
	}
});

var _Crypto_p256GetSharedSecret = F2(function(privKey, pubKey)
{
	return _Crypto_toHex(_Crypto_noble.p256.getSharedSecret(_Crypto_fromHex(privKey), _Crypto_fromHex(pubKey)));
});


// NOBLE/CIPHERS BUNDLE (https://github.com/paulmillr/noble-ciphers, MIT License)
// Embedded: @noble/ciphers - AES-GCM, ChaCha20-Poly1305, XChaCha20-Poly1305

var _Crypto_ciphers =(()=>{var _t=Object.defineProperty;var de=Object.getOwnPropertyDescriptor;var we=Object.getOwnPropertyNames;var be=Object.prototype.hasOwnProperty;var xe=(e,t)=>{for(var n in t)_t(e,n,{get:t[n],enumerable:!0})},me=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of we(t))!be.call(e,o)&&o!==n&&_t(e,o,{get:()=>t[o],enumerable:!(r=de(t,o))||r.enumerable});return e};var Le=e=>me(_t({},"_"+"_esModule",{value:!0}),e);var Ge={};xe(Ge,{cbc:()=>ne,cfb:()=>re,chacha20poly1305:()=>pe,ctr:()=>Gt,ecb:()=>ee,gcm:()=>oe,managedNonce:()=>Vt,randomBytes:()=>xt,siv:()=>se,xchacha20poly1305:()=>ye});function Ee(e){return e instanceof Uint8Array||ArrayBuffer.isView(e)&&e.constructor.name==="Uint8Array"}function yt(e){if(typeof e!="boolean")throw new Error(`boolean expected, not ${e}`)}function ht(e){if(!Number.isSafeInteger(e)||e<0)throw new Error("positive integer expected, got "+e)}function E(e,t,n=""){let r=Ee(e),o=e?.length,s=t!==void 0;if(!r||s&&o!==t){let i=n&&`"${n}" `,c=s?` of length ${t}`:"",f=r?`length=${o}`:`type=${typeof e}`;throw new Error(i+"expected Uint8Array"+c+", got "+f)}return e}function et(e,t=!0){if(e.destroyed)throw new Error("Hash instance has been destroyed");if(t&&e.finished)throw new Error("Hash#digest() has already been called")}function gt(e,t){E(e,void 0,"output");let n=t.outputLen;if(e.length<n)throw new Error("digestInto() expects output buffer of length at least "+n)}function dt(e){return new Uint8Array(e.buffer,e.byteOffset,e.byteLength)}function A(e){return new Uint32Array(e.buffer,e.byteOffset,Math.floor(e.byteLength/4))}function B(...e){for(let t=0;t<e.length;t++)e[t].fill(0)}function at(e){return new DataView(e.buffer,e.byteOffset,e.byteLength)}var Ue=new Uint8Array(new Uint32Array([287454020]).buffer)[0]===68;function vt(e,t){return e.buffer===t.buffer&&e.byteOffset<t.byteOffset+t.byteLength&&t.byteOffset<e.byteOffset+e.byteLength}function pt(e,t){if(vt(e,t)&&e.byteOffset<t.byteOffset)throw new Error("complex overlap of input and output is not supported")}function Ct(...e){let t=0;for(let r=0;r<e.length;r++){let o=e[r];E(o),t+=o.length}let n=new Uint8Array(t);for(let r=0,o=0;r<e.length;r++){let s=e[r];n.set(s,o),o+=s.length}return n}function jt(e,t){if(t==null||typeof t!="object")throw new Error("options must be defined");return Object.assign(e,t)}function wt(e,t){if(e.length!==t.length)return!1;let n=0;for(let r=0;r<e.length;r++)n|=e[r]^t[r];return n===0}var D=(e,t)=>{function n(r,...o){if(E(r,void 0,"key"),!Ue)throw new Error("Non little-endian hardware is not yet supported");if(e.nonceLength!==void 0){let h=o[0];E(h,e.varSizeNonce?void 0:e.nonceLength,"nonce")}let s=e.tagLength;s&&o[1]!==void 0&&E(o[1],void 0,"AAD");let i=t(r,...o),c=(h,a)=>{if(a!==void 0){if(h!==2)throw new Error("cipher output not supported");E(a,void 0,"output")}},f=!1;return{encrypt(h,a){if(f)throw new Error("cannot encrypt() twice with same key + nonce");return f=!0,E(h),c(i.encrypt.length,a),i.encrypt(h,a)},decrypt(h,a){if(E(h),s&&h.length<s)throw new Error('"ciphertext" expected length bigger than tagLength='+s);return c(i.decrypt.length,a),i.decrypt(h,a)}}}return Object.assign(n,e),n};function Q(e,t,n=!0){if(t===void 0)return new Uint8Array(e);if(t.length!==e)throw new Error('"output" expected Uint8Array of length '+e+", got: "+t.length);if(n&&!Z(t))throw new Error("invalid output, must be aligned");return t}function bt(e,t,n){yt(n);let r=new Uint8Array(16),o=at(r);return o.setBigUint64(0,BigInt(t),n),o.setBigUint64(8,BigInt(e),n),r}function Z(e){return e.byteOffset%4===0}function z(e){return Uint8Array.from(e)}function xt(e=32){let t=typeof globalThis=="object"?globalThis.crypto:null;if(typeof t?.getRandomValues!="function")throw new Error("crypto.getRandomValues must be defined");return t.getRandomValues(new Uint8Array(e))}function Vt(e,t=xt){let{nonceLength:n}=e;ht(n);let r=(o,s)=>{let i=Ct(o,s);return s.fill(0),i};return((o,...s)=>({encrypt(i){E(i);let c=t(n),f=e(o,c,...s).encrypt(i);return f instanceof Promise?f.then(l=>r(c,l)):r(c,f)},decrypt(i){E(i);let c=i.subarray(0,n),f=i.subarray(n);return e(o,c,...s).decrypt(f)}}))}var tt=16,Tt=new Uint8Array(16),G=A(Tt),Ae=225,Be=(e,t,n,r)=>{let o=r&1;return{s3:n<<31|r>>>1,s2:t<<31|n>>>1,s1:e<<31|t>>>1,s0:e>>>1^Ae<<24&-(o&1)}},F=e=>(e>>>0&255)<<24|(e>>>8&255)<<16|(e>>>16&255)<<8|e>>>24&255|0;function _e(e){e.reverse();let t=e[15]&1,n=0;for(let r=0;r<e.length;r++){let o=e[r];e[r]=o>>>1|n,n=(o&1)<<7}return e[0]^=-t&225,e}var ve=e=>e>64*1024?8:e>1024?4:2,mt=class{blockLen=tt;outputLen=tt;s0=0;s1=0;s2=0;s3=0;finished=!1;t;W;windowSize;constructor(t,n){E(t,16,"key"),t=z(t);let r=at(t),o=r.getUint32(0,!1),s=r.getUint32(4,!1),i=r.getUint32(8,!1),c=r.getUint32(12,!1),f=[];for(let u=0;u<128;u++)f.push({s0:F(o),s1:F(s),s2:F(i),s3:F(c)}),{s0:o,s1:s,s2:i,s3:c}=Be(o,s,i,c);let l=ve(n||1024);if(![1,2,4,8].includes(l))throw new Error("ghash: invalid window size, expected 2, 4 or 8");this.W=l;let a=128/l,p=this.windowSize=2**l,g=[];for(let u=0;u<a;u++)for(let y=0;y<p;y++){let d=0,w=0,b=0,U=0;for(let L=0;L<l;L++){if(!(y>>>l-L-1&1))continue;let{s0:v,s1:j,s2:V,s3:_}=f[l*u+L];d^=v,w^=j,b^=V,U^=_}g.push({s0:d,s1:w,s2:b,s3:U})}this.t=g}_updateBlock(t,n,r,o){t^=this.s0,n^=this.s1,r^=this.s2,o^=this.s3;let{W:s,t:i,windowSize:c}=this,f=0,l=0,h=0,a=0,p=(1<<s)-1,g=0;for(let u of[t,n,r,o])for(let y=0;y<4;y++){let d=u>>>8*y&255;for(let w=8/s-1;w>=0;w--){let b=d>>>s*w&p,{s0:U,s1:L,s2:C,s3:v}=i[g*c+b];f^=U,l^=L,h^=C,a^=v,g+=1}}this.s0=f,this.s1=l,this.s2=h,this.s3=a}update(t){et(this),E(t),t=z(t);let n=A(t),r=Math.floor(t.length/tt),o=t.length%tt;for(let s=0;s<r;s++)this._updateBlock(n[s*4+0],n[s*4+1],n[s*4+2],n[s*4+3]);return o&&(Tt.set(t.subarray(r*tt)),this._updateBlock(G[0],G[1],G[2],G[3]),B(G)),this}destroy(){let{t}=this;for(let n of t)n.s0=0,n.s1=0,n.s2=0,n.s3=0}digestInto(t){et(this),gt(t,this),this.finished=!0;let{s0:n,s1:r,s2:o,s3:s}=this,i=A(t);return i[0]=n,i[1]=r,i[2]=o,i[3]=s,t}digest(){let t=new Uint8Array(tt);return this.digestInto(t),this.destroy(),t}},St=class extends mt{constructor(t,n){E(t);let r=_e(z(t));super(r,n),B(r)}update(t){et(this),E(t),t=z(t);let n=A(t),r=t.length%tt,o=Math.floor(t.length/tt);for(let s=0;s<o;s++)this._updateBlock(F(n[s*4+3]),F(n[s*4+2]),F(n[s*4+1]),F(n[s*4+0]));return r&&(Tt.set(t.subarray(o*tt)),this._updateBlock(F(G[3]),F(G[2]),F(G[1]),F(G[0])),B(G)),this}digestInto(t){et(this),gt(t,this),this.finished=!0;let{s0:n,s1:r,s2:o,s3:s}=this,i=A(t);return i[0]=n,i[1]=r,i[2]=o,i[3]=s,t.reverse()}};function Ht(e){let t=(r,o)=>e(o,r.length).update(r).digest(),n=e(new Uint8Array(16),0);return t.outputLen=n.outputLen,t.blockLen=n.blockLen,t.create=(r,o)=>e(r,o),t}var It=Ht((e,t)=>new mt(e,t)),Ce=Ht((e,t)=>new St(e,t));var R=16,Nt=4,Lt=new Uint8Array(R);var Se=283;function $t(e){if(![16,24,32].includes(e.length))throw new Error('"aes key" expected Uint8Array of length 16/24/32, got length='+e.length)}function Mt(e){return e<<1^Se&-(e>>7)}function ut(e,t){let n=0;for(;t>0;t>>=1)n^=e&-(t&1),e=Mt(e);return n}var Te=(e,t,n=1)=>{if(!Number.isSafeInteger(n))throw new Error("incBytes: wrong carry "+n);E(e);for(let r=0;r<e.length;r++){let o=t?r:e.length-1-r;n=n+(e[o]&255)|0,e[o]=n&255,n>>>=8}},kt=(()=>{let e=new Uint8Array(256);for(let n=0,r=1;n<256;n++,r^=Mt(r))e[n]=r;let t=new Uint8Array(256);t[0]=99;for(let n=0;n<255;n++){let r=e[255-n];r|=r<<8,t[e[n]]=(r^r>>4^r>>5^r>>6^r>>7^99)&255}return B(e),t})(),Ie=kt.map((e,t)=>kt.indexOf(t)),Ke=e=>e<<24|e>>>8,Kt=e=>e<<8|e>>>24;function Zt(e,t){if(e.length!==256)throw new Error("Wrong sbox length");let n=new Uint32Array(256).map((l,h)=>t(e[h])),r=n.map(Kt),o=r.map(Kt),s=o.map(Kt),i=new Uint32Array(256*256),c=new Uint32Array(256*256),f=new Uint16Array(256*256);for(let l=0;l<256;l++)for(let h=0;h<256;h++){let a=l*256+h;i[a]=n[l]^r[h],c[a]=o[l]^s[h],f[a]=e[l]<<8|e[h]}return{sbox:e,sbox2:f,T0:n,T1:r,T2:o,T3:s,T01:i,T23:c}}var Pt=Zt(kt,e=>ut(e,3)<<24|e<<16|e<<8|ut(e,2)),Ft=Zt(Ie,e=>ut(e,11)<<24|ut(e,13)<<16|ut(e,9)<<8|ut(e,14)),Oe=(()=>{let e=new Uint8Array(16);for(let t=0,n=1;t<16;t++,n=Mt(n))e[t]=n;return e})();function rt(e){E(e);let t=e.length;$t(e);let{sbox2:n}=Pt,r=[];Z(e)||r.push(e=z(e));let o=A(e),s=o.length,i=f=>J(n,f,f,f,f),c=new Uint32Array(t+28);c.set(o);for(let f=s;f<c.length;f++){let l=c[f-1];f%s===0?l=i(Ke(l))^Oe[f/s-1]:s>6&&f%s===4&&(l=i(l)),c[f]=c[f-s]^l}return B(...r),c}function Yt(e){let t=rt(e),n=t.slice(),r=t.length,{sbox2:o}=Pt,{T0:s,T1:i,T2:c,T3:f}=Ft;for(let l=0;l<r;l+=4)for(let h=0;h<4;h++)n[l+h]=t[r-l-4+h];B(t);for(let l=4;l<r-4;l++){let h=n[l],a=J(o,h,h,h,h);n[l]=s[a&255]^i[a>>>8&255]^c[a>>>16&255]^f[a>>>24]}return n}function nt(e,t,n,r,o,s){return e[n<<8&65280|r>>>8&255]^t[o>>>8&65280|s>>>24&255]}function J(e,t,n,r,o){return e[t&255|n&65280]|e[r>>>16&255|o>>>16&65280]<<16}function Y(e,t,n,r,o){let{sbox2:s,T01:i,T23:c}=Pt,f=0;t^=e[f++],n^=e[f++],r^=e[f++],o^=e[f++];let l=e.length/4-2;for(let u=0;u<l;u++){let y=e[f++]^nt(i,c,t,n,r,o),d=e[f++]^nt(i,c,n,r,o,t),w=e[f++]^nt(i,c,r,o,t,n),b=e[f++]^nt(i,c,o,t,n,r);t=y,n=d,r=w,o=b}let h=e[f++]^J(s,t,n,r,o),a=e[f++]^J(s,n,r,o,t),p=e[f++]^J(s,r,o,t,n),g=e[f++]^J(s,o,t,n,r);return{s0:h,s1:a,s2:p,s3:g}}function Qt(e,t,n,r,o){let{sbox2:s,T01:i,T23:c}=Ft,f=0;t^=e[f++],n^=e[f++],r^=e[f++],o^=e[f++];let l=e.length/4-2;for(let u=0;u<l;u++){let y=e[f++]^nt(i,c,t,o,r,n),d=e[f++]^nt(i,c,n,t,o,r),w=e[f++]^nt(i,c,r,n,t,o),b=e[f++]^nt(i,c,o,r,n,t);t=y,n=d,r=w,o=b}let h=e[f++]^J(s,t,o,r,n),a=e[f++]^J(s,n,t,o,r),p=e[f++]^J(s,r,n,t,o),g=e[f++]^J(s,o,r,n,t);return{s0:h,s1:a,s2:p,s3:g}}function ke(e,t,n,r){E(t,R,"nonce"),E(n);let o=n.length;r=Q(o,r),pt(n,r);let s=t,i=A(s),{s0:c,s1:f,s2:l,s3:h}=Y(e,i[0],i[1],i[2],i[3]),a=A(n),p=A(r);for(let u=0;u+4<=a.length;u+=4)p[u+0]=a[u+0]^c,p[u+1]=a[u+1]^f,p[u+2]=a[u+2]^l,p[u+3]=a[u+3]^h,Te(s,!1,1),{s0:c,s1:f,s2:l,s3:h}=Y(e,i[0],i[1],i[2],i[3]);let g=R*Math.floor(a.length/Nt);if(g<o){let u=new Uint32Array([c,f,l,h]),y=dt(u);for(let d=g,w=0;d<o;d++,w++)r[d]=n[d]^y[w];B(u)}return r}function Et(e,t,n,r,o){E(n,R,"nonce"),E(r),o=Q(r.length,o);let s=n,i=A(s),c=at(s),f=A(r),l=A(o),h=t?0:12,a=r.length,p=c.getUint32(h,t),{s0:g,s1:u,s2:y,s3:d}=Y(e,i[0],i[1],i[2],i[3]);for(let b=0;b+4<=f.length;b+=4)l[b+0]=f[b+0]^g,l[b+1]=f[b+1]^u,l[b+2]=f[b+2]^y,l[b+3]=f[b+3]^d,p=p+1>>>0,c.setUint32(h,p,t),{s0:g,s1:u,s2:y,s3:d}=Y(e,i[0],i[1],i[2],i[3]);let w=R*Math.floor(f.length/Nt);if(w<a){let b=new Uint32Array([g,u,y,d]),U=dt(b);for(let L=w,C=0;L<a;L++,C++)o[L]=r[L]^U[C];B(b)}return o}var Gt=D({blockSize:16,nonceLength:16},function(t,n){function r(o,s){if(E(o),s!==void 0&&(E(s),!Z(s)))throw new Error("unaligned destination");let i=rt(t),c=z(n),f=[i,c];Z(o)||f.push(o=z(o));let l=ke(i,c,o,s);return B(...f),l}return{encrypt:(o,s)=>r(o,s),decrypt:(o,s)=>r(o,s)}});function Jt(e){if(E(e),e.length%R!==0)throw new Error("aes-(cbc/ecb).decrypt ciphertext should consist of blocks with size "+R)}function Xt(e,t,n){E(e);let r=e.length,o=r%R;if(!t&&o!==0)throw new Error("aec/(cbc-ecb): unpadded plaintext with disabled padding");Z(e)||(e=z(e));let s=A(e);if(t){let c=R-o;c||(c=R),r=r+c}n=Q(r,n),pt(e,n);let i=A(n);return{b:s,o:i,out:n}}function Dt(e,t){if(!t)return e;let n=e.length;if(!n)throw new Error("aes/pcks5: empty ciphertext not allowed");let r=e[n-1];if(r<=0||r>16)throw new Error("aes/pcks5: wrong padding");let o=e.subarray(0,-r);for(let s=0;s<r;s++)if(e[n-s-1]!==r)throw new Error("aes/pcks5: wrong padding");return o}function te(e){let t=new Uint8Array(16),n=A(t);t.set(e);let r=R-e.length;for(let o=R-r;o<R;o++)t[o]=r;return n}var ee=D({blockSize:16},function(t,n={}){let r=!n.disablePadding;return{encrypt(o,s){let{b:i,o:c,out:f}=Xt(o,r,s),l=rt(t),h=0;for(;h+4<=i.length;){let{s0:a,s1:p,s2:g,s3:u}=Y(l,i[h+0],i[h+1],i[h+2],i[h+3]);c[h++]=a,c[h++]=p,c[h++]=g,c[h++]=u}if(r){let a=te(o.subarray(h*4)),{s0:p,s1:g,s2:u,s3:y}=Y(l,a[0],a[1],a[2],a[3]);c[h++]=p,c[h++]=g,c[h++]=u,c[h++]=y}return B(l),f},decrypt(o,s){Jt(o);let i=Yt(t);s=Q(o.length,s);let c=[i];Z(o)||c.push(o=z(o)),pt(o,s);let f=A(o),l=A(s);for(let h=0;h+4<=f.length;){let{s0:a,s1:p,s2:g,s3:u}=Qt(i,f[h+0],f[h+1],f[h+2],f[h+3]);l[h++]=a,l[h++]=p,l[h++]=g,l[h++]=u}return B(...c),Dt(s,r)}}}),ne=D({blockSize:16,nonceLength:16},function(t,n,r={}){let o=!r.disablePadding;return{encrypt(s,i){let c=rt(t),{b:f,o:l,out:h}=Xt(s,o,i),a=n,p=[c];Z(a)||p.push(a=z(a));let g=A(a),u=g[0],y=g[1],d=g[2],w=g[3],b=0;for(;b+4<=f.length;)u^=f[b+0],y^=f[b+1],d^=f[b+2],w^=f[b+3],{s0:u,s1:y,s2:d,s3:w}=Y(c,u,y,d,w),l[b++]=u,l[b++]=y,l[b++]=d,l[b++]=w;if(o){let U=te(s.subarray(b*4));u^=U[0],y^=U[1],d^=U[2],w^=U[3],{s0:u,s1:y,s2:d,s3:w}=Y(c,u,y,d,w),l[b++]=u,l[b++]=y,l[b++]=d,l[b++]=w}return B(...p),h},decrypt(s,i){Jt(s);let c=Yt(t),f=n,l=[c];Z(f)||l.push(f=z(f));let h=A(f);i=Q(s.length,i),Z(s)||l.push(s=z(s)),pt(s,i);let a=A(s),p=A(i),g=h[0],u=h[1],y=h[2],d=h[3];for(let w=0;w+4<=a.length;){let b=g,U=u,L=y,C=d;g=a[w+0],u=a[w+1],y=a[w+2],d=a[w+3];let{s0:v,s1:j,s2:V,s3:_}=Qt(c,g,u,y,d);p[w++]=v^b,p[w++]=j^U,p[w++]=V^L,p[w++]=_^C}return B(...l),Dt(i,o)}}}),re=D({blockSize:16,nonceLength:16},function(t,n){function r(o,s,i){E(o);let c=o.length;if(i=Q(c,i),vt(o,i))throw new Error("overlapping src and dst not supported.");let f=rt(t),l=n,h=[f];Z(l)||h.push(l=z(l)),Z(o)||h.push(o=z(o));let a=A(o),p=A(i),g=s?p:a,u=A(l),y=u[0],d=u[1],w=u[2],b=u[3];for(let L=0;L+4<=a.length;){let{s0:C,s1:v,s2:j,s3:V}=Y(f,y,d,w,b);p[L+0]=a[L+0]^C,p[L+1]=a[L+1]^v,p[L+2]=a[L+2]^j,p[L+3]=a[L+3]^V,y=g[L++],d=g[L++],w=g[L++],b=g[L++]}let U=R*Math.floor(a.length/Nt);if(U<c){({s0:y,s1:d,s2:w,s3:b}=Y(f,y,d,w,b));let L=dt(new Uint32Array([y,d,w,b]));for(let C=U,v=0;C<c;C++,v++)i[C]=o[C]^L[v];B(L)}return B(...h),i}return{encrypt:(o,s)=>r(o,!0,s),decrypt:(o,s)=>r(o,!1,s)}});function Ne(e,t,n,r,o){let s=o?o.length:0,i=e.create(n,r.length+s);o&&i.update(o);let c=bt(8*r.length,8*s,t);i.update(r),i.update(c);let f=i.digest();return B(c),f}var oe=D({blockSize:16,nonceLength:12,tagLength:16,varSizeNonce:!0},function(t,n,r){if(n.length<8)throw new Error("aes/gcm: invalid nonce length");let o=16;function s(c,f,l){let h=Ne(It,!1,c,l,r);for(let a=0;a<f.length;a++)h[a]^=f[a];return h}function i(){let c=rt(t),f=Lt.slice(),l=Lt.slice();if(Et(c,!1,l,l,f),n.length===12)l.set(n);else{let a=Lt.slice();at(a).setBigUint64(8,BigInt(n.length*8),!1);let g=It.create(f).update(n).update(a);g.digestInto(l),g.destroy()}let h=Et(c,!1,l,Lt);return{xk:c,authKey:f,counter:l,tagMask:h}}return{encrypt(c){let{xk:f,authKey:l,counter:h,tagMask:a}=i(),p=new Uint8Array(c.length+o),g=[f,l,h,a];Z(c)||g.push(c=z(c)),Et(f,!1,h,c,p.subarray(0,c.length));let u=s(l,a,p.subarray(0,p.length-o));return g.push(u),p.set(u,c.length),B(...g),p},decrypt(c){let{xk:f,authKey:l,counter:h,tagMask:a}=i(),p=[f,l,a,h];Z(c)||p.push(c=z(c));let g=c.subarray(0,-o),u=c.subarray(-o),y=s(l,a,g);if(p.push(y),!wt(y,u))throw new Error("aes/gcm: invalid ghash tag");let d=Et(f,!1,h,g);return B(...p),d}}});function Me(e){return e instanceof Uint32Array||ArrayBuffer.isView(e)&&e.constructor.name==="Uint32Array"}function Ot(e,t){if(E(t,16,"block"),!Me(e))throw new Error("_encryptBlock accepts result of expandKeyLE");let n=A(t),{s0:r,s1:o,s2:s,s3:i}=Y(e,n[0],n[1],n[2],n[3]);return n[0]=r,n[1]=o,n[2]=s,n[3]=i,t}function qt(e){let t=0;for(let n=R-1;n>=0;n--){let r=(e[n]&128)>>>7;e[n]=e[n]<<1|t,t=r}return t&&(e[R-1]^=135),e}function Ut(e,t){if(e.length!==t.length)throw new Error("xorBlock: blocks must have same length");for(let n=0;n<e.length;n++)e[n]=e[n]^t[n];return e}var At=class{buffer;destroyed;k1;k2;xk;constructor(t){E(t),$t(t),this.xk=rt(t),this.buffer=new Uint8Array(0),this.destroyed=!1;let n=new Uint8Array(R);Ot(this.xk,n),this.k1=qt(n),this.k2=qt(new Uint8Array(this.k1))}update(t){let{destroyed:n,buffer:r}=this;if(n)throw new Error("CMAC instance was destroyed");E(t);let o=new Uint8Array(r.length+t.length);return o.set(r),o.set(t,r.length),this.buffer=o,this}digest(){if(this.destroyed)throw new Error("CMAC instance was destroyed");let{buffer:t}=this,n=t.length,r=Math.ceil(n/R),o;r===0?(r=1,o=!1):o=n%R===0;let s=(r-1)*R,i=t.subarray(s),c;if(o)c=Ut(new Uint8Array(i),this.k1);else{let l=new Uint8Array(R);l.set(i),l[i.length]=128,c=Ut(l,this.k2)}let f=new Uint8Array(R);for(let l=0;l<r-1;l++){let h=t.subarray(l*R,(l+1)*R);Ut(f,h),Ot(this.xk,f)}return Ut(f,c),Ot(this.xk,f),B(c),f}destroy(){let{buffer:t,destroyed:n,xk:r,k1:o,k2:s}=this;n||(this.destroyed=!0,B(t,r,o,s))}},Pe=(e,t)=>new At(e).update(t).digest();Pe.create=e=>new At(e);var se=()=>{throw new Error('"siv" from v1 is now "gcmsiv"')};var ie=e=>Uint8Array.from(e.split(""),t=>t.charCodeAt(0)),ze=ie("expand 16-byte k"),Re=ie("expand 32-byte k"),We=A(ze),je=A(Re);function x(e,t){return e<<t|e>>>32-t}function zt(e){return e.byteOffset%4===0}var Bt=64,Ve=16,fe=2**32-1,ce=Uint32Array.of();function He(e,t,n,r,o,s,i,c){let f=o.length,l=new Uint8Array(Bt),h=A(l),a=zt(o)&&zt(s),p=a?A(o):ce,g=a?A(s):ce;for(let u=0;u<f;i++){if(e(t,n,r,h,i,c),i>=fe)throw new Error("arx: counter overflow");let y=Math.min(Bt,f-u);if(a&&y===Bt){let d=u/4;if(u%4!==0)throw new Error("arx: invalid block position");for(let w=0,b;w<Ve;w++)b=d+w,g[b]=p[b]^h[w];u+=Bt;continue}for(let d=0,w;d<y;d++)w=u+d,s[w]=o[w]^l[d];u+=y}}function Rt(e,t){let{allowShortKeys:n,extendNonceFn:r,counterLength:o,counterRight:s,rounds:i}=jt({allowShortKeys:!1,counterLength:8,counterRight:!1,rounds:20},t);if(typeof e!="function")throw new Error("core must be a function");return ht(o),ht(i),yt(s),yt(n),(c,f,l,h,a=0)=>{E(c,void 0,"key"),E(f,void 0,"nonce"),E(l,void 0,"data");let p=l.length;if(h===void 0&&(h=new Uint8Array(p)),E(h,void 0,"output"),ht(a),a<0||a>=fe)throw new Error("arx: counter overflow");if(h.length<p)throw new Error(`arx: output (${h.length}) is shorter than data (${p})`);let g=[],u=c.length,y,d;if(u===32)g.push(y=z(c)),d=je;else if(u===16&&n)y=new Uint8Array(32),y.set(c),y.set(c,16),d=We,g.push(y);else throw E(c,32,"arx key"),new Error("invalid key size");zt(f)||g.push(f=z(f));let w=A(y);if(r){if(f.length!==24)throw new Error("arx: extended nonce must be 24 bytes");r(d,w,A(f.subarray(0,16)),w),f=f.subarray(16)}let b=16-o;if(b!==f.length)throw new Error(`arx: nonce must be ${b} or 16 bytes`);if(b!==12){let L=new Uint8Array(12);L.set(f,s?0:12-f.length),f=L,g.push(f)}let U=A(f);return He(e,d,w,U,l,h,a,i),B(...g),h}}function $(e,t){return e[t++]&255|(e[t++]&255)<<8}var Wt=class{blockLen=16;outputLen=16;buffer=new Uint8Array(16);r=new Uint16Array(10);h=new Uint16Array(10);pad=new Uint16Array(8);pos=0;finished=!1;constructor(t){t=z(E(t,32,"key"));let n=$(t,0),r=$(t,2),o=$(t,4),s=$(t,6),i=$(t,8),c=$(t,10),f=$(t,12),l=$(t,14);this.r[0]=n&8191,this.r[1]=(n>>>13|r<<3)&8191,this.r[2]=(r>>>10|o<<6)&7939,this.r[3]=(o>>>7|s<<9)&8191,this.r[4]=(s>>>4|i<<12)&255,this.r[5]=i>>>1&8190,this.r[6]=(i>>>14|c<<2)&8191,this.r[7]=(c>>>11|f<<5)&8065,this.r[8]=(f>>>8|l<<8)&8191,this.r[9]=l>>>5&127;for(let h=0;h<8;h++)this.pad[h]=$(t,16+2*h)}process(t,n,r=!1){let o=r?0:2048,{h:s,r:i}=this,c=i[0],f=i[1],l=i[2],h=i[3],a=i[4],p=i[5],g=i[6],u=i[7],y=i[8],d=i[9],w=$(t,n+0),b=$(t,n+2),U=$(t,n+4),L=$(t,n+6),C=$(t,n+8),v=$(t,n+10),j=$(t,n+12),V=$(t,n+14),_=s[0]+(w&8191),S=s[1]+((w>>>13|b<<3)&8191),T=s[2]+((b>>>10|U<<6)&8191),I=s[3]+((U>>>7|L<<9)&8191),K=s[4]+((L>>>4|C<<12)&8191),O=s[5]+(C>>>1&8191),k=s[6]+((C>>>14|v<<2)&8191),N=s[7]+((v>>>11|j<<5)&8191),M=s[8]+((j>>>8|V<<8)&8191),P=s[9]+(V>>>5|o),m=0,H=m+_*c+S*(5*d)+T*(5*y)+I*(5*u)+K*(5*g);m=H>>>13,H&=8191,H+=O*(5*p)+k*(5*a)+N*(5*h)+M*(5*l)+P*(5*f),m+=H>>>13,H&=8191;let q=m+_*f+S*c+T*(5*d)+I*(5*y)+K*(5*u);m=q>>>13,q&=8191,q+=O*(5*g)+k*(5*p)+N*(5*a)+M*(5*h)+P*(5*l),m+=q>>>13,q&=8191;let W=m+_*l+S*f+T*c+I*(5*d)+K*(5*y);m=W>>>13,W&=8191,W+=O*(5*u)+k*(5*g)+N*(5*p)+M*(5*a)+P*(5*h),m+=W>>>13,W&=8191;let X=m+_*h+S*l+T*f+I*c+K*(5*d);m=X>>>13,X&=8191,X+=O*(5*y)+k*(5*u)+N*(5*g)+M*(5*p)+P*(5*a),m+=X>>>13,X&=8191;let ot=m+_*a+S*h+T*l+I*f+K*c;m=ot>>>13,ot&=8191,ot+=O*(5*d)+k*(5*y)+N*(5*u)+M*(5*g)+P*(5*p),m+=ot>>>13,ot&=8191;let st=m+_*p+S*a+T*h+I*l+K*f;m=st>>>13,st&=8191,st+=O*c+k*(5*d)+N*(5*y)+M*(5*u)+P*(5*g),m+=st>>>13,st&=8191;let ct=m+_*g+S*p+T*a+I*h+K*l;m=ct>>>13,ct&=8191,ct+=O*f+k*c+N*(5*d)+M*(5*y)+P*(5*u),m+=ct>>>13,ct&=8191;let it=m+_*u+S*g+T*p+I*a+K*h;m=it>>>13,it&=8191,it+=O*l+k*f+N*c+M*(5*d)+P*(5*y),m+=it>>>13,it&=8191;let ft=m+_*y+S*u+T*g+I*p+K*a;m=ft>>>13,ft&=8191,ft+=O*h+k*l+N*f+M*c+P*(5*d),m+=ft>>>13,ft&=8191;let lt=m+_*d+S*y+T*u+I*g+K*p;m=lt>>>13,lt&=8191,lt+=O*a+k*h+N*l+M*f+P*c,m+=lt>>>13,lt&=8191,m=(m<<2)+m|0,m=m+H|0,H=m&8191,m=m>>>13,q+=m,s[0]=H,s[1]=q,s[2]=W,s[3]=X,s[4]=ot,s[5]=st,s[6]=ct,s[7]=it,s[8]=ft,s[9]=lt}finalize(){let{h:t,pad:n}=this,r=new Uint16Array(10),o=t[1]>>>13;t[1]&=8191;for(let c=2;c<10;c++)t[c]+=o,o=t[c]>>>13,t[c]&=8191;t[0]+=o*5,o=t[0]>>>13,t[0]&=8191,t[1]+=o,o=t[1]>>>13,t[1]&=8191,t[2]+=o,r[0]=t[0]+5,o=r[0]>>>13,r[0]&=8191;for(let c=1;c<10;c++)r[c]=t[c]+o,o=r[c]>>>13,r[c]&=8191;r[9]-=8192;let s=(o^1)-1;for(let c=0;c<10;c++)r[c]&=s;s=~s;for(let c=0;c<10;c++)t[c]=t[c]&s|r[c];t[0]=(t[0]|t[1]<<13)&65535,t[1]=(t[1]>>>3|t[2]<<10)&65535,t[2]=(t[2]>>>6|t[3]<<7)&65535,t[3]=(t[3]>>>9|t[4]<<4)&65535,t[4]=(t[4]>>>12|t[5]<<1|t[6]<<14)&65535,t[5]=(t[6]>>>2|t[7]<<11)&65535,t[6]=(t[7]>>>5|t[8]<<8)&65535,t[7]=(t[8]>>>8|t[9]<<5)&65535;let i=t[0]+n[0];t[0]=i&65535;for(let c=1;c<8;c++)i=(t[c]+n[c]|0)+(i>>>16)|0,t[c]=i&65535;B(r)}update(t){et(this),E(t),t=z(t);let{buffer:n,blockLen:r}=this,o=t.length;for(let s=0;s<o;){let i=Math.min(r-this.pos,o-s);if(i===r){for(;r<=o-s;s+=r)this.process(t,s);continue}n.set(t.subarray(s,s+i),this.pos),this.pos+=i,s+=i,this.pos===r&&(this.process(n,0,!1),this.pos=0)}return this}destroy(){B(this.h,this.r,this.buffer,this.pad)}digestInto(t){et(this),gt(t,this),this.finished=!0;let{buffer:n,h:r}=this,{pos:o}=this;if(o){for(n[o++]=1;o<16;o++)n[o]=0;this.process(n,0,!0)}this.finalize();let s=0;for(let i=0;i<8;i++)t[s++]=r[i]>>>0,t[s++]=r[i]>>>8;return t}digest(){let{buffer:t,outputLen:n}=this;this.digestInto(t);let r=t.slice(0,n);return this.destroy(),r}};function qe(e){let t=(r,o)=>e(o).update(r).digest(),n=e(new Uint8Array(32));return t.outputLen=n.outputLen,t.blockLen=n.blockLen,t.create=r=>e(r),t}var le=qe(e=>new Wt(e));function ue(e,t,n,r,o,s=20){let i=e[0],c=e[1],f=e[2],l=e[3],h=t[0],a=t[1],p=t[2],g=t[3],u=t[4],y=t[5],d=t[6],w=t[7],b=o,U=n[0],L=n[1],C=n[2],v=i,j=c,V=f,_=l,S=h,T=a,I=p,K=g,O=u,k=y,N=d,M=w,P=b,m=U,H=L,q=C;for(let X=0;X<s;X+=2)v=v+S|0,P=x(P^v,16),O=O+P|0,S=x(S^O,12),v=v+S|0,P=x(P^v,8),O=O+P|0,S=x(S^O,7),j=j+T|0,m=x(m^j,16),k=k+m|0,T=x(T^k,12),j=j+T|0,m=x(m^j,8),k=k+m|0,T=x(T^k,7),V=V+I|0,H=x(H^V,16),N=N+H|0,I=x(I^N,12),V=V+I|0,H=x(H^V,8),N=N+H|0,I=x(I^N,7),_=_+K|0,q=x(q^_,16),M=M+q|0,K=x(K^M,12),_=_+K|0,q=x(q^_,8),M=M+q|0,K=x(K^M,7),v=v+T|0,q=x(q^v,16),N=N+q|0,T=x(T^N,12),v=v+T|0,q=x(q^v,8),N=N+q|0,T=x(T^N,7),j=j+I|0,P=x(P^j,16),M=M+P|0,I=x(I^M,12),j=j+I|0,P=x(P^j,8),M=M+P|0,I=x(I^M,7),V=V+K|0,m=x(m^V,16),O=O+m|0,K=x(K^O,12),V=V+K|0,m=x(m^V,8),O=O+m|0,K=x(K^O,7),_=_+S|0,H=x(H^_,16),k=k+H|0,S=x(S^k,12),_=_+S|0,H=x(H^_,8),k=k+H|0,S=x(S^k,7);let W=0;r[W++]=i+v|0,r[W++]=c+j|0,r[W++]=f+V|0,r[W++]=l+_|0,r[W++]=h+S|0,r[W++]=a+T|0,r[W++]=p+I|0,r[W++]=g+K|0,r[W++]=u+O|0,r[W++]=y+k|0,r[W++]=d+N|0,r[W++]=w+M|0,r[W++]=b+P|0,r[W++]=U+m|0,r[W++]=L+H|0,r[W++]=C+q|0}function $e(e,t,n,r){let o=e[0],s=e[1],i=e[2],c=e[3],f=t[0],l=t[1],h=t[2],a=t[3],p=t[4],g=t[5],u=t[6],y=t[7],d=n[0],w=n[1],b=n[2],U=n[3];for(let C=0;C<20;C+=2)o=o+f|0,d=x(d^o,16),p=p+d|0,f=x(f^p,12),o=o+f|0,d=x(d^o,8),p=p+d|0,f=x(f^p,7),s=s+l|0,w=x(w^s,16),g=g+w|0,l=x(l^g,12),s=s+l|0,w=x(w^s,8),g=g+w|0,l=x(l^g,7),i=i+h|0,b=x(b^i,16),u=u+b|0,h=x(h^u,12),i=i+h|0,b=x(b^i,8),u=u+b|0,h=x(h^u,7),c=c+a|0,U=x(U^c,16),y=y+U|0,a=x(a^y,12),c=c+a|0,U=x(U^c,8),y=y+U|0,a=x(a^y,7),o=o+l|0,U=x(U^o,16),u=u+U|0,l=x(l^u,12),o=o+l|0,U=x(U^o,8),u=u+U|0,l=x(l^u,7),s=s+h|0,d=x(d^s,16),y=y+d|0,h=x(h^y,12),s=s+h|0,d=x(d^s,8),y=y+d|0,h=x(h^y,7),i=i+a|0,w=x(w^i,16),p=p+w|0,a=x(a^p,12),i=i+a|0,w=x(w^i,8),p=p+w|0,a=x(a^p,7),c=c+f|0,b=x(b^c,16),g=g+b|0,f=x(f^g,12),c=c+f|0,b=x(b^c,8),g=g+b|0,f=x(f^g,7);let L=0;r[L++]=o,r[L++]=s,r[L++]=i,r[L++]=c,r[L++]=d,r[L++]=w,r[L++]=b,r[L++]=U}var Ze=Rt(ue,{counterRight:!1,counterLength:4,allowShortKeys:!1}),Fe=Rt(ue,{counterRight:!1,counterLength:8,extendNonceFn:$e,allowShortKeys:!1});var Ye=new Uint8Array(16),he=(e,t)=>{e.update(t);let n=t.length%16;n&&e.update(Ye.subarray(n))},Qe=new Uint8Array(32);function ae(e,t,n,r,o){o!==void 0&&E(o,void 0,"AAD");let s=e(t,n,Qe),i=bt(r.length,o?o.length:0,!0),c=le.create(s);o&&he(c,o),he(c,r),c.update(i);let f=c.digest();return B(s,i),f}var ge=e=>(t,n,r)=>({encrypt(s,i){let c=s.length;i=Q(c+16,i,!1),i.set(s);let f=i.subarray(0,-16);e(t,n,f,f,1);let l=ae(e,t,n,f,r);return i.set(l,c),B(l),i},decrypt(s,i){i=Q(s.length-16,i,!1);let c=s.subarray(0,-16),f=s.subarray(-16),l=ae(e,t,n,c,r);if(!wt(f,l))throw new Error("invalid tag");return i.set(s.subarray(0,-16)),e(t,n,i,i,1),B(l),i}}),pe=D({blockSize:64,nonceLength:12,tagLength:16},ge(Ze)),ye=D({blockSize:64,nonceLength:24,tagLength:16},ge(Fe));return Le(Ge);})();
/*! Bundled license information:

@noble/ciphers/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)
*/


// CIPHER FUNCTIONS

function _Crypto_cipherKeyFromHex(hex)
{
	try {
		var bytes = _Crypto_fromHex(hex);
		if (bytes.length !== 32) { return $elm$core$Maybe$Nothing; }
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_cipherKeyToHex(key)
{
	return key;
}

function _Crypto_cipherNonce12FromHex(hex)
{
	try {
		var bytes = _Crypto_fromHex(hex);
		if (bytes.length !== 12) { return $elm$core$Maybe$Nothing; }
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_cipherNonce12ToHex(nonce)
{
	return nonce;
}

function _Crypto_cipherNonce24FromHex(hex)
{
	try {
		var bytes = _Crypto_fromHex(hex);
		if (bytes.length !== 24) { return $elm$core$Maybe$Nothing; }
		return $elm$core$Maybe$Just(hex);
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
}

function _Crypto_cipherNonce24ToHex(nonce)
{
	return nonce;
}


// AES-256-GCM

var _Crypto_aesGcmEncrypt = F3(function(key, nonce, plaintext)
{
	var cipher = _Crypto_ciphers.gcm(_Crypto_fromHex(key), _Crypto_fromHex(nonce));
	return _Crypto_toHex(cipher.encrypt(_Crypto_fromHex(plaintext)));
});

var _Crypto_aesGcmDecrypt = F3(function(key, nonce, ciphertext)
{
	try {
		var cipher = _Crypto_ciphers.gcm(_Crypto_fromHex(key), _Crypto_fromHex(nonce));
		return $elm$core$Maybe$Just(_Crypto_toHex(cipher.decrypt(_Crypto_fromHex(ciphertext))));
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
});


// CHACHA20-POLY1305

var _Crypto_chacha20Encrypt = F3(function(key, nonce, plaintext)
{
	var cipher = _Crypto_ciphers.chacha20poly1305(_Crypto_fromHex(key), _Crypto_fromHex(nonce));
	return _Crypto_toHex(cipher.encrypt(_Crypto_fromHex(plaintext)));
});

var _Crypto_chacha20Decrypt = F3(function(key, nonce, ciphertext)
{
	try {
		var cipher = _Crypto_ciphers.chacha20poly1305(_Crypto_fromHex(key), _Crypto_fromHex(nonce));
		return $elm$core$Maybe$Just(_Crypto_toHex(cipher.decrypt(_Crypto_fromHex(ciphertext))));
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
});


// XCHACHA20-POLY1305

var _Crypto_xchacha20Encrypt = F3(function(key, nonce, plaintext)
{
	var cipher = _Crypto_ciphers.xchacha20poly1305(_Crypto_fromHex(key), _Crypto_fromHex(nonce));
	return _Crypto_toHex(cipher.encrypt(_Crypto_fromHex(plaintext)));
});

var _Crypto_xchacha20Decrypt = F3(function(key, nonce, ciphertext)
{
	try {
		var cipher = _Crypto_ciphers.xchacha20poly1305(_Crypto_fromHex(key), _Crypto_fromHex(nonce));
		return $elm$core$Maybe$Just(_Crypto_toHex(cipher.decrypt(_Crypto_fromHex(ciphertext))));
	} catch (e) {
		return $elm$core$Maybe$Nothing;
	}
});
function _Utils_cmp(x, y, ord) {if (typeof x !== 'object') {return x === y ? 0 : x < y ? -1 : 1; }if (x instanceof String) {var a = x.valueOf(); var b = y.valueOf();return a === b ? 0 : a < b ? -1 : 1; }if (typeof x.$ === 'undefined' || (typeof x.$ === 'string' && x.$[0] === '#')) {var keys = Object.keys(x).sort();for (var i = 0; i < keys.length; i++) {var k = keys[i];if (k === '$') continue;ord = _Utils_cmp(x[k], y[k]);if (ord) return ord; }return 0; }if (x.$ === '::' || x.$ === '[]') {for (; x.b && y.b && !(ord = _Utils_cmp(x.a, y.a)); x = x.b, y = y.b) {}return ord || (x.b ? 1 : y.b ? -1 : 0); }if (x.$ !== y.$) {return x.$ < y.$ ? -1 : 1; }var keys = Object.keys(x);for (var i = 0; i < keys.length; i++) {var k = keys[i];if (k === '$') continue;ord = _Utils_cmp(x[k], y[k]);if (ord) return ord; }return 0; }
var $elm$core$List$cons = _List_cons;
var $elm$core$Elm$JsArray$foldr = _JsArray_foldr;
var $elm$core$Array$foldr = F3(
	function (func, baseCase, _v0) {
		var tree = _v0.c;
		var tail = _v0.d;
		var helper = F2(
			function (node, acc) {
				if (node.$ === 'SubTree') {
					var subTree = node.a;
					return A3($elm$core$Elm$JsArray$foldr, helper, acc, subTree);
				} else {
					var values = node.a;
					return A3($elm$core$Elm$JsArray$foldr, func, acc, values);
				}
			});
		return A3(
			$elm$core$Elm$JsArray$foldr,
			helper,
			A3($elm$core$Elm$JsArray$foldr, func, baseCase, tail),
			tree);
	});
var $elm$core$Array$toList = function (array) {
	return A3($elm$core$Array$foldr, $elm$core$List$cons, _List_Nil, array);
};
var $elm$core$Dict$foldr = F3(
	function (func, acc, t) {
		foldr:
		while (true) {
			if (t.$ === 'RBEmpty_elm_builtin') {
				return acc;
			} else {
				var key = t.b;
				var value = t.c;
				var left = t.d;
				var right = t.e;
				var $temp$func = func,
					$temp$acc = A3(
					func,
					key,
					value,
					A3($elm$core$Dict$foldr, func, acc, right)),
					$temp$t = left;
				func = $temp$func;
				acc = $temp$acc;
				t = $temp$t;
				continue foldr;
			}
		}
	});
var $elm$core$Dict$toList = function (dict) {
	return A3(
		$elm$core$Dict$foldr,
		F3(
			function (key, value, list) {
				return A2(
					$elm$core$List$cons,
					_Utils_Tuple2(key, value),
					list);
			}),
		_List_Nil,
		dict);
};
var $elm$core$Dict$keys = function (dict) {
	return A3(
		$elm$core$Dict$foldr,
		F3(
			function (key, value, keyList) {
				return A2($elm$core$List$cons, key, keyList);
			}),
		_List_Nil,
		dict);
};
var $elm$core$Set$toList = function (_v0) {
	var dict = _v0.a;
	return $elm$core$Dict$keys(dict);
};
var $elm$core$Basics$EQ = {$: 'EQ'};
var $elm$core$Basics$GT = {$: 'GT'};
var $elm$core$Basics$LT = {$: 'LT'};
var $elm$core$Result$Err = function (a) {
	return {$: 'Err', a: a};
};
var $elm$json$Json$Decode$Failure = F2(
	function (a, b) {
		return {$: 'Failure', a: a, b: b};
	});
var $elm$json$Json$Decode$Field = F2(
	function (a, b) {
		return {$: 'Field', a: a, b: b};
	});
var $elm$json$Json$Decode$Index = F2(
	function (a, b) {
		return {$: 'Index', a: a, b: b};
	});
var $elm$core$Result$Ok = function (a) {
	return {$: 'Ok', a: a};
};
var $elm$json$Json$Decode$OneOf = function (a) {
	return {$: 'OneOf', a: a};
};
var $elm$core$Basics$False = {$: 'False'};
var $elm$core$Basics$add = _Basics_add;
var $elm$core$Maybe$Just = function (a) {
	return {$: 'Just', a: a};
};
var $elm$core$Maybe$Nothing = {$: 'Nothing'};
var $elm$core$String$all = _String_all;
var $elm$core$Basics$and = _Basics_and;
var $elm$core$Basics$append = _Utils_append;
var $elm$json$Json$Encode$encode = _Json_encode;
var $elm$core$String$fromInt = _String_fromNumber;
var $elm$core$String$join = F2(
	function (sep, chunks) {
		return A2(
			_String_join,
			sep,
			_List_toArray(chunks));
	});
var $elm$core$String$split = F2(
	function (sep, string) {
		return _List_fromArray(
			A2(_String_split, sep, string));
	});
var $elm$json$Json$Decode$indent = function (str) {
	return A2(
		$elm$core$String$join,
		'\n    ',
		A2($elm$core$String$split, '\n', str));
};
var $elm$core$List$foldl = F3(
	function (func, acc, list) {
		foldl:
		while (true) {
			if (!list.b) {
				return acc;
			} else {
				var x = list.a;
				var xs = list.b;
				var $temp$func = func,
					$temp$acc = A2(func, x, acc),
					$temp$list = xs;
				func = $temp$func;
				acc = $temp$acc;
				list = $temp$list;
				continue foldl;
			}
		}
	});
var $elm$core$List$length = function (xs) {
	return A3(
		$elm$core$List$foldl,
		F2(
			function (_v0, i) {
				return i + 1;
			}),
		0,
		xs);
};
var $elm$core$List$map2 = _List_map2;
var $elm$core$Basics$le = _Utils_le;
var $elm$core$Basics$sub = _Basics_sub;
var $elm$core$List$rangeHelp = F3(
	function (lo, hi, list) {
		rangeHelp:
		while (true) {
			if (_Utils_cmp(lo, hi) < 1) {
				var $temp$lo = lo,
					$temp$hi = hi - 1,
					$temp$list = A2($elm$core$List$cons, hi, list);
				lo = $temp$lo;
				hi = $temp$hi;
				list = $temp$list;
				continue rangeHelp;
			} else {
				return list;
			}
		}
	});
var $elm$core$List$range = F2(
	function (lo, hi) {
		return A3($elm$core$List$rangeHelp, lo, hi, _List_Nil);
	});
var $elm$core$List$indexedMap = F2(
	function (f, xs) {
		return A3(
			$elm$core$List$map2,
			f,
			A2(
				$elm$core$List$range,
				0,
				$elm$core$List$length(xs) - 1),
			xs);
	});
var $elm$core$Char$toCode = _Char_toCode;
var $elm$core$Char$isLower = function (_char) {
	var code = $elm$core$Char$toCode(_char);
	return (97 <= code) && (code <= 122);
};
var $elm$core$Char$isUpper = function (_char) {
	var code = $elm$core$Char$toCode(_char);
	return (code <= 90) && (65 <= code);
};
var $elm$core$Basics$or = _Basics_or;
var $elm$core$Char$isAlpha = function (_char) {
	return $elm$core$Char$isLower(_char) || $elm$core$Char$isUpper(_char);
};
var $elm$core$Char$isDigit = function (_char) {
	var code = $elm$core$Char$toCode(_char);
	return (code <= 57) && (48 <= code);
};
var $elm$core$Char$isAlphaNum = function (_char) {
	return $elm$core$Char$isLower(_char) || ($elm$core$Char$isUpper(_char) || $elm$core$Char$isDigit(_char));
};
var $elm$core$List$reverse = function (list) {
	return A3($elm$core$List$foldl, $elm$core$List$cons, _List_Nil, list);
};
var $elm$core$String$uncons = _String_uncons;
var $elm$json$Json$Decode$errorOneOf = F2(
	function (i, error) {
		return '\n\n(' + ($elm$core$String$fromInt(i + 1) + (') ' + $elm$json$Json$Decode$indent(
			$elm$json$Json$Decode$errorToString(error))));
	});
var $elm$json$Json$Decode$errorToString = function (error) {
	return A2($elm$json$Json$Decode$errorToStringHelp, error, _List_Nil);
};
var $elm$json$Json$Decode$errorToStringHelp = F2(
	function (error, context) {
		errorToStringHelp:
		while (true) {
			switch (error.$) {
				case 'Field':
					var f = error.a;
					var err = error.b;
					var isSimple = function () {
						var _v1 = $elm$core$String$uncons(f);
						if (_v1.$ === 'Nothing') {
							return false;
						} else {
							var _v2 = _v1.a;
							var _char = _v2.a;
							var rest = _v2.b;
							return $elm$core$Char$isAlpha(_char) && A2($elm$core$String$all, $elm$core$Char$isAlphaNum, rest);
						}
					}();
					var fieldName = isSimple ? ('.' + f) : ('[\'' + (f + '\']'));
					var $temp$error = err,
						$temp$context = A2($elm$core$List$cons, fieldName, context);
					error = $temp$error;
					context = $temp$context;
					continue errorToStringHelp;
				case 'Index':
					var i = error.a;
					var err = error.b;
					var indexName = '[' + ($elm$core$String$fromInt(i) + ']');
					var $temp$error = err,
						$temp$context = A2($elm$core$List$cons, indexName, context);
					error = $temp$error;
					context = $temp$context;
					continue errorToStringHelp;
				case 'OneOf':
					var errors = error.a;
					if (!errors.b) {
						return 'Ran into a Json.Decode.oneOf with no possibilities' + function () {
							if (!context.b) {
								return '!';
							} else {
								return ' at json' + A2(
									$elm$core$String$join,
									'',
									$elm$core$List$reverse(context));
							}
						}();
					} else {
						if (!errors.b.b) {
							var err = errors.a;
							var $temp$error = err,
								$temp$context = context;
							error = $temp$error;
							context = $temp$context;
							continue errorToStringHelp;
						} else {
							var starter = function () {
								if (!context.b) {
									return 'Json.Decode.oneOf';
								} else {
									return 'The Json.Decode.oneOf at json' + A2(
										$elm$core$String$join,
										'',
										$elm$core$List$reverse(context));
								}
							}();
							var introduction = starter + (' failed in the following ' + ($elm$core$String$fromInt(
								$elm$core$List$length(errors)) + ' ways:'));
							return A2(
								$elm$core$String$join,
								'\n\n',
								A2(
									$elm$core$List$cons,
									introduction,
									A2($elm$core$List$indexedMap, $elm$json$Json$Decode$errorOneOf, errors)));
						}
					}
				default:
					var msg = error.a;
					var json = error.b;
					var introduction = function () {
						if (!context.b) {
							return 'Problem with the given value:\n\n';
						} else {
							return 'Problem with the value at json' + (A2(
								$elm$core$String$join,
								'',
								$elm$core$List$reverse(context)) + ':\n\n    ');
						}
					}();
					return introduction + ($elm$json$Json$Decode$indent(
						A2($elm$json$Json$Encode$encode, 4, json)) + ('\n\n' + msg));
			}
		}
	});
var $elm$core$Array$branchFactor = 32;
var $elm$core$Array$Array_elm_builtin = F4(
	function (a, b, c, d) {
		return {$: 'Array_elm_builtin', a: a, b: b, c: c, d: d};
	});
var $elm$core$Elm$JsArray$empty = _JsArray_empty;
var $elm$core$Basics$ceiling = _Basics_ceiling;
var $elm$core$Basics$fdiv = _Basics_fdiv;
var $elm$core$Basics$logBase = F2(
	function (base, number) {
		return _Basics_log(number) / _Basics_log(base);
	});
var $elm$core$Basics$toFloat = _Basics_toFloat;
var $elm$core$Array$shiftStep = $elm$core$Basics$ceiling(
	A2($elm$core$Basics$logBase, 2, $elm$core$Array$branchFactor));
var $elm$core$Array$empty = A4($elm$core$Array$Array_elm_builtin, 0, $elm$core$Array$shiftStep, $elm$core$Elm$JsArray$empty, $elm$core$Elm$JsArray$empty);
var $elm$core$Elm$JsArray$initialize = _JsArray_initialize;
var $elm$core$Array$Leaf = function (a) {
	return {$: 'Leaf', a: a};
};
var $elm$core$Basics$apL = F2(
	function (f, x) {
		return f(x);
	});
var $elm$core$Basics$apR = F2(
	function (x, f) {
		return f(x);
	});
var $elm$core$Basics$eq = _Utils_equal;
var $elm$core$Basics$floor = _Basics_floor;
var $elm$core$Elm$JsArray$length = _JsArray_length;
var $elm$core$Basics$gt = _Utils_gt;
var $elm$core$Basics$max = F2(
	function (x, y) {
		return (_Utils_cmp(x, y) > 0) ? x : y;
	});
var $elm$core$Basics$mul = _Basics_mul;
var $elm$core$Array$SubTree = function (a) {
	return {$: 'SubTree', a: a};
};
var $elm$core$Elm$JsArray$initializeFromList = _JsArray_initializeFromList;
var $elm$core$Array$compressNodes = F2(
	function (nodes, acc) {
		compressNodes:
		while (true) {
			var _v0 = A2($elm$core$Elm$JsArray$initializeFromList, $elm$core$Array$branchFactor, nodes);
			var node = _v0.a;
			var remainingNodes = _v0.b;
			var newAcc = A2(
				$elm$core$List$cons,
				$elm$core$Array$SubTree(node),
				acc);
			if (!remainingNodes.b) {
				return $elm$core$List$reverse(newAcc);
			} else {
				var $temp$nodes = remainingNodes,
					$temp$acc = newAcc;
				nodes = $temp$nodes;
				acc = $temp$acc;
				continue compressNodes;
			}
		}
	});
var $elm$core$Tuple$first = function (_v0) {
	var x = _v0.a;
	return x;
};
var $elm$core$Array$treeFromBuilder = F2(
	function (nodeList, nodeListSize) {
		treeFromBuilder:
		while (true) {
			var newNodeSize = $elm$core$Basics$ceiling(nodeListSize / $elm$core$Array$branchFactor);
			if (newNodeSize === 1) {
				return A2($elm$core$Elm$JsArray$initializeFromList, $elm$core$Array$branchFactor, nodeList).a;
			} else {
				var $temp$nodeList = A2($elm$core$Array$compressNodes, nodeList, _List_Nil),
					$temp$nodeListSize = newNodeSize;
				nodeList = $temp$nodeList;
				nodeListSize = $temp$nodeListSize;
				continue treeFromBuilder;
			}
		}
	});
var $elm$core$Array$builderToArray = F2(
	function (reverseNodeList, builder) {
		if (!builder.nodeListSize) {
			return A4(
				$elm$core$Array$Array_elm_builtin,
				$elm$core$Elm$JsArray$length(builder.tail),
				$elm$core$Array$shiftStep,
				$elm$core$Elm$JsArray$empty,
				builder.tail);
		} else {
			var treeLen = builder.nodeListSize * $elm$core$Array$branchFactor;
			var depth = $elm$core$Basics$floor(
				A2($elm$core$Basics$logBase, $elm$core$Array$branchFactor, treeLen - 1));
			var correctNodeList = reverseNodeList ? $elm$core$List$reverse(builder.nodeList) : builder.nodeList;
			var tree = A2($elm$core$Array$treeFromBuilder, correctNodeList, builder.nodeListSize);
			return A4(
				$elm$core$Array$Array_elm_builtin,
				$elm$core$Elm$JsArray$length(builder.tail) + treeLen,
				A2($elm$core$Basics$max, 5, depth * $elm$core$Array$shiftStep),
				tree,
				builder.tail);
		}
	});
var $elm$core$Basics$idiv = _Basics_idiv;
var $elm$core$Basics$lt = _Utils_lt;
var $elm$core$Array$initializeHelp = F5(
	function (fn, fromIndex, len, nodeList, tail) {
		initializeHelp:
		while (true) {
			if (fromIndex < 0) {
				return A2(
					$elm$core$Array$builderToArray,
					false,
					{nodeList: nodeList, nodeListSize: (len / $elm$core$Array$branchFactor) | 0, tail: tail});
			} else {
				var leaf = $elm$core$Array$Leaf(
					A3($elm$core$Elm$JsArray$initialize, $elm$core$Array$branchFactor, fromIndex, fn));
				var $temp$fn = fn,
					$temp$fromIndex = fromIndex - $elm$core$Array$branchFactor,
					$temp$len = len,
					$temp$nodeList = A2($elm$core$List$cons, leaf, nodeList),
					$temp$tail = tail;
				fn = $temp$fn;
				fromIndex = $temp$fromIndex;
				len = $temp$len;
				nodeList = $temp$nodeList;
				tail = $temp$tail;
				continue initializeHelp;
			}
		}
	});
var $elm$core$Basics$remainderBy = _Basics_remainderBy;
var $elm$core$Array$initialize = F2(
	function (len, fn) {
		if (len <= 0) {
			return $elm$core$Array$empty;
		} else {
			var tailLen = len % $elm$core$Array$branchFactor;
			var tail = A3($elm$core$Elm$JsArray$initialize, tailLen, len - tailLen, fn);
			var initialFromIndex = (len - tailLen) - $elm$core$Array$branchFactor;
			return A5($elm$core$Array$initializeHelp, fn, initialFromIndex, len, _List_Nil, tail);
		}
	});
var $elm$core$Basics$True = {$: 'True'};
var $elm$core$Result$isOk = function (result) {
	if (result.$ === 'Ok') {
		return true;
	} else {
		return false;
	}
};
var $elm$json$Json$Decode$map = _Json_map1;
var $elm$json$Json$Decode$map2 = _Json_map2;
var $elm$json$Json$Decode$succeed = _Json_succeed;
var $lynxjs_elm$virtual_dom$VirtualDom$toHandlerInt = function (handler) {
	switch (handler.$) {
		case 'Normal':
			return 0;
		case 'MayStopPropagation':
			return 1;
		case 'MayPreventDefault':
			return 2;
		default:
			return 3;
	}
};
var $elm$core$Basics$identity = function (x) {
	return x;
};
var $lynxjs_elm$browser$Browser$Dom$NotFound = function (a) {
	return {$: 'NotFound', a: a};
};
var $elm$core$Basics$never = function (_v0) {
	never:
	while (true) {
		var nvr = _v0.a;
		var $temp$_v0 = nvr;
		_v0 = $temp$_v0;
		continue never;
	}
};
var $elm$core$Task$Perform = function (a) {
	return {$: 'Perform', a: a};
};
var $elm$core$Task$succeed = _Scheduler_succeed;
var $elm$core$Task$init = $elm$core$Task$succeed(_Utils_Tuple0);
var $elm$core$List$foldrHelper = F4(
	function (fn, acc, ctr, ls) {
		if (!ls.b) {
			return acc;
		} else {
			var a = ls.a;
			var r1 = ls.b;
			if (!r1.b) {
				return A2(fn, a, acc);
			} else {
				var b = r1.a;
				var r2 = r1.b;
				if (!r2.b) {
					return A2(
						fn,
						a,
						A2(fn, b, acc));
				} else {
					var c = r2.a;
					var r3 = r2.b;
					if (!r3.b) {
						return A2(
							fn,
							a,
							A2(
								fn,
								b,
								A2(fn, c, acc)));
					} else {
						var d = r3.a;
						var r4 = r3.b;
						var res = (ctr > 500) ? A3(
							$elm$core$List$foldl,
							fn,
							acc,
							$elm$core$List$reverse(r4)) : A4($elm$core$List$foldrHelper, fn, acc, ctr + 1, r4);
						return A2(
							fn,
							a,
							A2(
								fn,
								b,
								A2(
									fn,
									c,
									A2(fn, d, res))));
					}
				}
			}
		}
	});
var $elm$core$List$foldr = F3(
	function (fn, acc, ls) {
		return A4($elm$core$List$foldrHelper, fn, acc, 0, ls);
	});
var $elm$core$List$map = F2(
	function (f, xs) {
		return A3(
			$elm$core$List$foldr,
			F2(
				function (x, acc) {
					return A2(
						$elm$core$List$cons,
						f(x),
						acc);
				}),
			_List_Nil,
			xs);
	});
var $elm$core$Task$andThen = _Scheduler_andThen;
var $elm$core$Task$map = F2(
	function (func, taskA) {
		return A2(
			$elm$core$Task$andThen,
			function (a) {
				return $elm$core$Task$succeed(
					func(a));
			},
			taskA);
	});
var $elm$core$Task$map2 = F3(
	function (func, taskA, taskB) {
		return A2(
			$elm$core$Task$andThen,
			function (a) {
				return A2(
					$elm$core$Task$andThen,
					function (b) {
						return $elm$core$Task$succeed(
							A2(func, a, b));
					},
					taskB);
			},
			taskA);
	});
var $elm$core$Task$sequence = function (tasks) {
	return A3(
		$elm$core$List$foldr,
		$elm$core$Task$map2($elm$core$List$cons),
		$elm$core$Task$succeed(_List_Nil),
		tasks);
};
var $elm$core$Platform$sendToApp = _Platform_sendToApp;
var $elm$core$Task$spawnCmd = F2(
	function (router, _v0) {
		var task = _v0.a;
		return _Scheduler_spawn(
			A2(
				$elm$core$Task$andThen,
				$elm$core$Platform$sendToApp(router),
				task));
	});
var $elm$core$Task$onEffects = F3(
	function (router, commands, state) {
		return A2(
			$elm$core$Task$map,
			function (_v0) {
				return _Utils_Tuple0;
			},
			$elm$core$Task$sequence(
				A2(
					$elm$core$List$map,
					$elm$core$Task$spawnCmd(router),
					commands)));
	});
var $elm$core$Task$onSelfMsg = F3(
	function (_v0, _v1, _v2) {
		return $elm$core$Task$succeed(_Utils_Tuple0);
	});
var $elm$core$Task$cmdMap = F2(
	function (tagger, _v0) {
		var task = _v0.a;
		return $elm$core$Task$Perform(
			A2($elm$core$Task$map, tagger, task));
	});
_Platform_effectManagers['Task'] = _Platform_createManager($elm$core$Task$init, $elm$core$Task$onEffects, $elm$core$Task$onSelfMsg, $elm$core$Task$cmdMap);
var $elm$core$Task$command = _Platform_leaf('Task');
var $elm$core$Task$perform = F2(
	function (toMessage, task) {
		return $elm$core$Task$command(
			$elm$core$Task$Perform(
				A2($elm$core$Task$map, toMessage, task)));
	});
var $lynxjs_elm$browser$Browser$element = _Browser_element;
var $author$project$Main$GotSeed = function (a) {
	return {$: 'GotSeed', a: a};
};
var $author$project$Main$SetupScreen = {$: 'SetupScreen'};
var $elm$core$Dict$RBEmpty_elm_builtin = {$: 'RBEmpty_elm_builtin'};
var $elm$core$Dict$empty = $elm$core$Dict$RBEmpty_elm_builtin;
var $elm$core$Set$Set_elm_builtin = function (a) {
	return {$: 'Set_elm_builtin', a: a};
};
var $elm$core$Set$empty = $elm$core$Set$Set_elm_builtin($elm$core$Dict$empty);
var $elm$random$Random$Generate = function (a) {
	return {$: 'Generate', a: a};
};
var $elm$random$Random$Seed = F2(
	function (a, b) {
		return {$: 'Seed', a: a, b: b};
	});
var $elm$core$Bitwise$shiftRightZfBy = _Bitwise_shiftRightZfBy;
var $elm$random$Random$next = function (_v0) {
	var state0 = _v0.a;
	var incr = _v0.b;
	return A2($elm$random$Random$Seed, ((state0 * 1664525) + incr) >>> 0, incr);
};
var $elm$random$Random$initialSeed = function (x) {
	var _v0 = $elm$random$Random$next(
		A2($elm$random$Random$Seed, 0, 1013904223));
	var state1 = _v0.a;
	var incr = _v0.b;
	var state2 = (state1 + x) >>> 0;
	return $elm$random$Random$next(
		A2($elm$random$Random$Seed, state2, incr));
};
var $elm$time$Time$Name = function (a) {
	return {$: 'Name', a: a};
};
var $elm$time$Time$Offset = function (a) {
	return {$: 'Offset', a: a};
};
var $elm$time$Time$Zone = F2(
	function (a, b) {
		return {$: 'Zone', a: a, b: b};
	});
var $elm$time$Time$customZone = $elm$time$Time$Zone;
var $elm$time$Time$Posix = function (a) {
	return {$: 'Posix', a: a};
};
var $elm$time$Time$millisToPosix = $elm$time$Time$Posix;
var $elm$time$Time$now = _Time_now($elm$time$Time$millisToPosix);
var $elm$time$Time$posixToMillis = function (_v0) {
	var millis = _v0.a;
	return millis;
};
var $elm$random$Random$init = A2(
	$elm$core$Task$andThen,
	function (time) {
		return $elm$core$Task$succeed(
			$elm$random$Random$initialSeed(
				$elm$time$Time$posixToMillis(time)));
	},
	$elm$time$Time$now);
var $elm$random$Random$step = F2(
	function (_v0, seed) {
		var generator = _v0.a;
		return generator(seed);
	});
var $elm$random$Random$onEffects = F3(
	function (router, commands, seed) {
		if (!commands.b) {
			return $elm$core$Task$succeed(seed);
		} else {
			var generator = commands.a.a;
			var rest = commands.b;
			var _v1 = A2($elm$random$Random$step, generator, seed);
			var value = _v1.a;
			var newSeed = _v1.b;
			return A2(
				$elm$core$Task$andThen,
				function (_v2) {
					return A3($elm$random$Random$onEffects, router, rest, newSeed);
				},
				A2($elm$core$Platform$sendToApp, router, value));
		}
	});
var $elm$random$Random$onSelfMsg = F3(
	function (_v0, _v1, seed) {
		return $elm$core$Task$succeed(seed);
	});
var $elm$random$Random$Generator = function (a) {
	return {$: 'Generator', a: a};
};
var $elm$random$Random$map = F2(
	function (func, _v0) {
		var genA = _v0.a;
		return $elm$random$Random$Generator(
			function (seed0) {
				var _v1 = genA(seed0);
				var a = _v1.a;
				var seed1 = _v1.b;
				return _Utils_Tuple2(
					func(a),
					seed1);
			});
	});
var $elm$random$Random$cmdMap = F2(
	function (func, _v0) {
		var generator = _v0.a;
		return $elm$random$Random$Generate(
			A2($elm$random$Random$map, func, generator));
	});
_Platform_effectManagers['Random'] = _Platform_createManager($elm$random$Random$init, $elm$random$Random$onEffects, $elm$random$Random$onSelfMsg, $elm$random$Random$cmdMap);
var $elm$random$Random$command = _Platform_leaf('Random');
var $elm$random$Random$generate = F2(
	function (tagger, generator) {
		return $elm$random$Random$command(
			$elm$random$Random$Generate(
				A2($elm$random$Random$map, tagger, generator)));
	});
var $elm$core$String$fromList = _String_fromList;
var $elm$random$Random$listHelp = F4(
	function (revList, n, gen, seed) {
		listHelp:
		while (true) {
			if (n < 1) {
				return _Utils_Tuple2(revList, seed);
			} else {
				var _v0 = gen(seed);
				var value = _v0.a;
				var newSeed = _v0.b;
				var $temp$revList = A2($elm$core$List$cons, value, revList),
					$temp$n = n - 1,
					$temp$gen = gen,
					$temp$seed = newSeed;
				revList = $temp$revList;
				n = $temp$n;
				gen = $temp$gen;
				seed = $temp$seed;
				continue listHelp;
			}
		}
	});
var $elm$random$Random$list = F2(
	function (n, _v0) {
		var gen = _v0.a;
		return $elm$random$Random$Generator(
			function (seed) {
				return A4($elm$random$Random$listHelp, _List_Nil, n, gen, seed);
			});
	});
var $elm$core$Char$fromCode = _Char_fromCode;
var $elm$core$Bitwise$and = _Bitwise_and;
var $elm$core$Basics$negate = function (n) {
	return -n;
};
var $elm$core$Bitwise$xor = _Bitwise_xor;
var $elm$random$Random$peel = function (_v0) {
	var state = _v0.a;
	var word = (state ^ (state >>> ((state >>> 28) + 4))) * 277803737;
	return ((word >>> 22) ^ word) >>> 0;
};
var $elm$random$Random$int = F2(
	function (a, b) {
		return $elm$random$Random$Generator(
			function (seed0) {
				var _v0 = (_Utils_cmp(a, b) < 0) ? _Utils_Tuple2(a, b) : _Utils_Tuple2(b, a);
				var lo = _v0.a;
				var hi = _v0.b;
				var range = (hi - lo) + 1;
				if (!((range - 1) & range)) {
					return _Utils_Tuple2(
						(((range - 1) & $elm$random$Random$peel(seed0)) >>> 0) + lo,
						$elm$random$Random$next(seed0));
				} else {
					var threshhold = (((-range) >>> 0) % range) >>> 0;
					var accountForBias = function (seed) {
						accountForBias:
						while (true) {
							var x = $elm$random$Random$peel(seed);
							var seedN = $elm$random$Random$next(seed);
							if (_Utils_cmp(x, threshhold) < 0) {
								var $temp$seed = seedN;
								seed = $temp$seed;
								continue accountForBias;
							} else {
								return _Utils_Tuple2((x % range) + lo, seedN);
							}
						}
					};
					return accountForBias(seed0);
				}
			});
	});
var $author$project$Main$randomHexChar = A2(
	$elm$random$Random$map,
	function (n) {
		return (n < 10) ? $elm$core$Char$fromCode(n + 48) : $elm$core$Char$fromCode((n - 10) + 97);
	},
	A2($elm$random$Random$int, 0, 15));
var $author$project$Main$randomHexString = function (byteCount) {
	return A2(
		$elm$random$Random$map,
		$elm$core$String$fromList,
		A2($elm$random$Random$list, byteCount * 2, $author$project$Main$randomHexChar));
};
var $author$project$Main$init = function (_v0) {
	return _Utils_Tuple2(
		{activeChat: '', addIdentity: '', addName: '', authToken: '', connecting: false, contacts: $elm$core$Dict$empty, currentTime: 0, displayName: '', draft: '', edPriv: $elm$core$Maybe$Nothing, edPub: $elm$core$Maybe$Nothing, error: $elm$core$Maybe$Nothing, messages: $elm$core$Dict$empty, screen: $author$project$Main$SetupScreen, seenIds: $elm$core$Set$empty, sending: false, serverUrl: 'http://localhost:8080', xPriv: $elm$core$Maybe$Nothing, xPub: $elm$core$Maybe$Nothing},
		A2(
			$elm$random$Random$generate,
			$author$project$Main$GotSeed,
			$author$project$Main$randomHexString(32)));
};
var $author$project$Main$GotTime = function (a) {
	return {$: 'GotTime', a: a};
};
var $author$project$Main$PollTick = function (a) {
	return {$: 'PollTick', a: a};
};
var $elm$core$Platform$Sub$batch = _Platform_batch;
var $elm$time$Time$Every = F2(
	function (a, b) {
		return {$: 'Every', a: a, b: b};
	});
var $elm$time$Time$State = F2(
	function (taggers, processes) {
		return {processes: processes, taggers: taggers};
	});
var $elm$time$Time$init = $elm$core$Task$succeed(
	A2($elm$time$Time$State, $elm$core$Dict$empty, $elm$core$Dict$empty));
var $elm$core$Basics$compare = _Utils_compare;
var $elm$core$Dict$get = F2(
	function (targetKey, dict) {
		get:
		while (true) {
			if (dict.$ === 'RBEmpty_elm_builtin') {
				return $elm$core$Maybe$Nothing;
			} else {
				var key = dict.b;
				var value = dict.c;
				var left = dict.d;
				var right = dict.e;
				var _v1 = A2($elm$core$Basics$compare, targetKey, key);
				switch (_v1.$) {
					case 'LT':
						var $temp$targetKey = targetKey,
							$temp$dict = left;
						targetKey = $temp$targetKey;
						dict = $temp$dict;
						continue get;
					case 'EQ':
						return $elm$core$Maybe$Just(value);
					default:
						var $temp$targetKey = targetKey,
							$temp$dict = right;
						targetKey = $temp$targetKey;
						dict = $temp$dict;
						continue get;
				}
			}
		}
	});
var $elm$core$Dict$Black = {$: 'Black'};
var $elm$core$Dict$RBNode_elm_builtin = F5(
	function (a, b, c, d, e) {
		return {$: 'RBNode_elm_builtin', a: a, b: b, c: c, d: d, e: e};
	});
var $elm$core$Dict$Red = {$: 'Red'};
var $elm$core$Dict$balance = F5(
	function (color, key, value, left, right) {
		if ((right.$ === 'RBNode_elm_builtin') && (right.a.$ === 'Red')) {
			var _v1 = right.a;
			var rK = right.b;
			var rV = right.c;
			var rLeft = right.d;
			var rRight = right.e;
			if ((left.$ === 'RBNode_elm_builtin') && (left.a.$ === 'Red')) {
				var _v3 = left.a;
				var lK = left.b;
				var lV = left.c;
				var lLeft = left.d;
				var lRight = left.e;
				return A5(
					$elm$core$Dict$RBNode_elm_builtin,
					$elm$core$Dict$Red,
					key,
					value,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Black, lK, lV, lLeft, lRight),
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Black, rK, rV, rLeft, rRight));
			} else {
				return A5(
					$elm$core$Dict$RBNode_elm_builtin,
					color,
					rK,
					rV,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, key, value, left, rLeft),
					rRight);
			}
		} else {
			if ((((left.$ === 'RBNode_elm_builtin') && (left.a.$ === 'Red')) && (left.d.$ === 'RBNode_elm_builtin')) && (left.d.a.$ === 'Red')) {
				var _v5 = left.a;
				var lK = left.b;
				var lV = left.c;
				var _v6 = left.d;
				var _v7 = _v6.a;
				var llK = _v6.b;
				var llV = _v6.c;
				var llLeft = _v6.d;
				var llRight = _v6.e;
				var lRight = left.e;
				return A5(
					$elm$core$Dict$RBNode_elm_builtin,
					$elm$core$Dict$Red,
					lK,
					lV,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Black, llK, llV, llLeft, llRight),
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Black, key, value, lRight, right));
			} else {
				return A5($elm$core$Dict$RBNode_elm_builtin, color, key, value, left, right);
			}
		}
	});
var $elm$core$Dict$insertHelp = F3(
	function (key, value, dict) {
		if (dict.$ === 'RBEmpty_elm_builtin') {
			return A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, key, value, $elm$core$Dict$RBEmpty_elm_builtin, $elm$core$Dict$RBEmpty_elm_builtin);
		} else {
			var nColor = dict.a;
			var nKey = dict.b;
			var nValue = dict.c;
			var nLeft = dict.d;
			var nRight = dict.e;
			var _v1 = A2($elm$core$Basics$compare, key, nKey);
			switch (_v1.$) {
				case 'LT':
					return A5(
						$elm$core$Dict$balance,
						nColor,
						nKey,
						nValue,
						A3($elm$core$Dict$insertHelp, key, value, nLeft),
						nRight);
				case 'EQ':
					return A5($elm$core$Dict$RBNode_elm_builtin, nColor, nKey, value, nLeft, nRight);
				default:
					return A5(
						$elm$core$Dict$balance,
						nColor,
						nKey,
						nValue,
						nLeft,
						A3($elm$core$Dict$insertHelp, key, value, nRight));
			}
		}
	});
var $elm$core$Dict$insert = F3(
	function (key, value, dict) {
		var _v0 = A3($elm$core$Dict$insertHelp, key, value, dict);
		if ((_v0.$ === 'RBNode_elm_builtin') && (_v0.a.$ === 'Red')) {
			var _v1 = _v0.a;
			var k = _v0.b;
			var v = _v0.c;
			var l = _v0.d;
			var r = _v0.e;
			return A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Black, k, v, l, r);
		} else {
			var x = _v0;
			return x;
		}
	});
var $elm$time$Time$addMySub = F2(
	function (_v0, state) {
		var interval = _v0.a;
		var tagger = _v0.b;
		var _v1 = A2($elm$core$Dict$get, interval, state);
		if (_v1.$ === 'Nothing') {
			return A3(
				$elm$core$Dict$insert,
				interval,
				_List_fromArray(
					[tagger]),
				state);
		} else {
			var taggers = _v1.a;
			return A3(
				$elm$core$Dict$insert,
				interval,
				A2($elm$core$List$cons, tagger, taggers),
				state);
		}
	});
var $elm$core$Process$kill = _Scheduler_kill;
var $elm$core$Dict$foldl = F3(
	function (func, acc, dict) {
		foldl:
		while (true) {
			if (dict.$ === 'RBEmpty_elm_builtin') {
				return acc;
			} else {
				var key = dict.b;
				var value = dict.c;
				var left = dict.d;
				var right = dict.e;
				var $temp$func = func,
					$temp$acc = A3(
					func,
					key,
					value,
					A3($elm$core$Dict$foldl, func, acc, left)),
					$temp$dict = right;
				func = $temp$func;
				acc = $temp$acc;
				dict = $temp$dict;
				continue foldl;
			}
		}
	});
var $elm$core$Dict$merge = F6(
	function (leftStep, bothStep, rightStep, leftDict, rightDict, initialResult) {
		var stepState = F3(
			function (rKey, rValue, _v0) {
				stepState:
				while (true) {
					var list = _v0.a;
					var result = _v0.b;
					if (!list.b) {
						return _Utils_Tuple2(
							list,
							A3(rightStep, rKey, rValue, result));
					} else {
						var _v2 = list.a;
						var lKey = _v2.a;
						var lValue = _v2.b;
						var rest = list.b;
						if (_Utils_cmp(lKey, rKey) < 0) {
							var $temp$rKey = rKey,
								$temp$rValue = rValue,
								$temp$_v0 = _Utils_Tuple2(
								rest,
								A3(leftStep, lKey, lValue, result));
							rKey = $temp$rKey;
							rValue = $temp$rValue;
							_v0 = $temp$_v0;
							continue stepState;
						} else {
							if (_Utils_cmp(lKey, rKey) > 0) {
								return _Utils_Tuple2(
									list,
									A3(rightStep, rKey, rValue, result));
							} else {
								return _Utils_Tuple2(
									rest,
									A4(bothStep, lKey, lValue, rValue, result));
							}
						}
					}
				}
			});
		var _v3 = A3(
			$elm$core$Dict$foldl,
			stepState,
			_Utils_Tuple2(
				$elm$core$Dict$toList(leftDict),
				initialResult),
			rightDict);
		var leftovers = _v3.a;
		var intermediateResult = _v3.b;
		return A3(
			$elm$core$List$foldl,
			F2(
				function (_v4, result) {
					var k = _v4.a;
					var v = _v4.b;
					return A3(leftStep, k, v, result);
				}),
			intermediateResult,
			leftovers);
	});
var $elm$core$Platform$sendToSelf = _Platform_sendToSelf;
var $elm$time$Time$setInterval = _Time_setInterval;
var $elm$core$Process$spawn = _Scheduler_spawn;
var $elm$time$Time$spawnHelp = F3(
	function (router, intervals, processes) {
		if (!intervals.b) {
			return $elm$core$Task$succeed(processes);
		} else {
			var interval = intervals.a;
			var rest = intervals.b;
			var spawnTimer = $elm$core$Process$spawn(
				A2(
					$elm$time$Time$setInterval,
					interval,
					A2($elm$core$Platform$sendToSelf, router, interval)));
			var spawnRest = function (id) {
				return A3(
					$elm$time$Time$spawnHelp,
					router,
					rest,
					A3($elm$core$Dict$insert, interval, id, processes));
			};
			return A2($elm$core$Task$andThen, spawnRest, spawnTimer);
		}
	});
var $elm$time$Time$onEffects = F3(
	function (router, subs, _v0) {
		var processes = _v0.processes;
		var rightStep = F3(
			function (_v6, id, _v7) {
				var spawns = _v7.a;
				var existing = _v7.b;
				var kills = _v7.c;
				return _Utils_Tuple3(
					spawns,
					existing,
					A2(
						$elm$core$Task$andThen,
						function (_v5) {
							return kills;
						},
						$elm$core$Process$kill(id)));
			});
		var newTaggers = A3($elm$core$List$foldl, $elm$time$Time$addMySub, $elm$core$Dict$empty, subs);
		var leftStep = F3(
			function (interval, taggers, _v4) {
				var spawns = _v4.a;
				var existing = _v4.b;
				var kills = _v4.c;
				return _Utils_Tuple3(
					A2($elm$core$List$cons, interval, spawns),
					existing,
					kills);
			});
		var bothStep = F4(
			function (interval, taggers, id, _v3) {
				var spawns = _v3.a;
				var existing = _v3.b;
				var kills = _v3.c;
				return _Utils_Tuple3(
					spawns,
					A3($elm$core$Dict$insert, interval, id, existing),
					kills);
			});
		var _v1 = A6(
			$elm$core$Dict$merge,
			leftStep,
			bothStep,
			rightStep,
			newTaggers,
			processes,
			_Utils_Tuple3(
				_List_Nil,
				$elm$core$Dict$empty,
				$elm$core$Task$succeed(_Utils_Tuple0)));
		var spawnList = _v1.a;
		var existingDict = _v1.b;
		var killTask = _v1.c;
		return A2(
			$elm$core$Task$andThen,
			function (newProcesses) {
				return $elm$core$Task$succeed(
					A2($elm$time$Time$State, newTaggers, newProcesses));
			},
			A2(
				$elm$core$Task$andThen,
				function (_v2) {
					return A3($elm$time$Time$spawnHelp, router, spawnList, existingDict);
				},
				killTask));
	});
var $elm$time$Time$onSelfMsg = F3(
	function (router, interval, state) {
		var _v0 = A2($elm$core$Dict$get, interval, state.taggers);
		if (_v0.$ === 'Nothing') {
			return $elm$core$Task$succeed(state);
		} else {
			var taggers = _v0.a;
			var tellTaggers = function (time) {
				return $elm$core$Task$sequence(
					A2(
						$elm$core$List$map,
						function (tagger) {
							return A2(
								$elm$core$Platform$sendToApp,
								router,
								tagger(time));
						},
						taggers));
			};
			return A2(
				$elm$core$Task$andThen,
				function (_v1) {
					return $elm$core$Task$succeed(state);
				},
				A2($elm$core$Task$andThen, tellTaggers, $elm$time$Time$now));
		}
	});
var $elm$core$Basics$composeL = F3(
	function (g, f, x) {
		return g(
			f(x));
	});
var $elm$time$Time$subMap = F2(
	function (f, _v0) {
		var interval = _v0.a;
		var tagger = _v0.b;
		return A2(
			$elm$time$Time$Every,
			interval,
			A2($elm$core$Basics$composeL, f, tagger));
	});
_Platform_effectManagers['Time'] = _Platform_createManager($elm$time$Time$init, $elm$time$Time$onEffects, $elm$time$Time$onSelfMsg, 0, $elm$time$Time$subMap);
var $elm$time$Time$subscription = _Platform_leaf('Time');
var $elm$time$Time$every = F2(
	function (interval, tagger) {
		return $elm$time$Time$subscription(
			A2($elm$time$Time$Every, interval, tagger));
	});
var $elm$core$Basics$neq = _Utils_notEqual;
var $elm$core$Platform$Sub$none = $elm$core$Platform$Sub$batch(_List_Nil);
var $author$project$Main$subscriptions = function (model) {
	return $elm$core$Platform$Sub$batch(
		_List_fromArray(
			[
				(model.authToken !== '') ? A2($elm$time$Time$every, 3000, $author$project$Main$PollTick) : $elm$core$Platform$Sub$none,
				A2($elm$time$Time$every, 60000, $author$project$Main$GotTime)
			]));
};
var $author$project$Main$ChatScreen = {$: 'ChatScreen'};
var $author$project$Main$ContactsScreen = {$: 'ContactsScreen'};
var $author$project$Main$GotSendEntropy = function (a) {
	return {$: 'GotSendEntropy', a: a};
};
var $author$project$Main$GotAck = function (a) {
	return {$: 'GotAck', a: a};
};
var $elm$json$Json$Decode$bool = _Json_decodeBool;
var $elm$json$Json$Decode$decodeString = _Json_runOnString;
var $elm$bytes$Bytes$Encode$getWidth = function (builder) {
	switch (builder.$) {
		case 'I8':
			return 1;
		case 'I16':
			return 2;
		case 'I32':
			return 4;
		case 'U8':
			return 1;
		case 'U16':
			return 2;
		case 'U32':
			return 4;
		case 'F32':
			return 4;
		case 'F64':
			return 8;
		case 'Seq':
			var w = builder.a;
			return w;
		case 'Utf8':
			var w = builder.a;
			return w;
		default:
			var bs = builder.a;
			return _Bytes_width(bs);
	}
};
var $elm$bytes$Bytes$LE = {$: 'LE'};
var $elm$bytes$Bytes$Encode$write = F3(
	function (builder, mb, offset) {
		switch (builder.$) {
			case 'I8':
				var n = builder.a;
				return A3(_Bytes_write_i8, mb, offset, n);
			case 'I16':
				var e = builder.a;
				var n = builder.b;
				return A4(
					_Bytes_write_i16,
					mb,
					offset,
					n,
					_Utils_eq(e, $elm$bytes$Bytes$LE));
			case 'I32':
				var e = builder.a;
				var n = builder.b;
				return A4(
					_Bytes_write_i32,
					mb,
					offset,
					n,
					_Utils_eq(e, $elm$bytes$Bytes$LE));
			case 'U8':
				var n = builder.a;
				return A3(_Bytes_write_u8, mb, offset, n);
			case 'U16':
				var e = builder.a;
				var n = builder.b;
				return A4(
					_Bytes_write_u16,
					mb,
					offset,
					n,
					_Utils_eq(e, $elm$bytes$Bytes$LE));
			case 'U32':
				var e = builder.a;
				var n = builder.b;
				return A4(
					_Bytes_write_u32,
					mb,
					offset,
					n,
					_Utils_eq(e, $elm$bytes$Bytes$LE));
			case 'F32':
				var e = builder.a;
				var n = builder.b;
				return A4(
					_Bytes_write_f32,
					mb,
					offset,
					n,
					_Utils_eq(e, $elm$bytes$Bytes$LE));
			case 'F64':
				var e = builder.a;
				var n = builder.b;
				return A4(
					_Bytes_write_f64,
					mb,
					offset,
					n,
					_Utils_eq(e, $elm$bytes$Bytes$LE));
			case 'Seq':
				var bs = builder.b;
				return A3($elm$bytes$Bytes$Encode$writeSequence, bs, mb, offset);
			case 'Utf8':
				var s = builder.b;
				return A3(_Bytes_write_string, mb, offset, s);
			default:
				var bs = builder.a;
				return A3(_Bytes_write_bytes, mb, offset, bs);
		}
	});
var $elm$bytes$Bytes$Encode$writeSequence = F3(
	function (builders, mb, offset) {
		writeSequence:
		while (true) {
			if (!builders.b) {
				return offset;
			} else {
				var b = builders.a;
				var bs = builders.b;
				var $temp$builders = bs,
					$temp$mb = mb,
					$temp$offset = A3($elm$bytes$Bytes$Encode$write, b, mb, offset);
				builders = $temp$builders;
				mb = $temp$mb;
				offset = $temp$offset;
				continue writeSequence;
			}
		}
	});
var $lynxjs_elm$http$Http$BadStatus_ = F2(
	function (a, b) {
		return {$: 'BadStatus_', a: a, b: b};
	});
var $lynxjs_elm$http$Http$BadUrl_ = function (a) {
	return {$: 'BadUrl_', a: a};
};
var $lynxjs_elm$http$Http$GoodStatus_ = F2(
	function (a, b) {
		return {$: 'GoodStatus_', a: a, b: b};
	});
var $lynxjs_elm$http$Http$NetworkError_ = {$: 'NetworkError_'};
var $lynxjs_elm$http$Http$Timeout_ = {$: 'Timeout_'};
var $elm$core$Maybe$isJust = function (maybe) {
	if (maybe.$ === 'Just') {
		return true;
	} else {
		return false;
	}
};
var $elm$core$Dict$getMin = function (dict) {
	getMin:
	while (true) {
		if ((dict.$ === 'RBNode_elm_builtin') && (dict.d.$ === 'RBNode_elm_builtin')) {
			var left = dict.d;
			var $temp$dict = left;
			dict = $temp$dict;
			continue getMin;
		} else {
			return dict;
		}
	}
};
var $elm$core$Dict$moveRedLeft = function (dict) {
	if (((dict.$ === 'RBNode_elm_builtin') && (dict.d.$ === 'RBNode_elm_builtin')) && (dict.e.$ === 'RBNode_elm_builtin')) {
		if ((dict.e.d.$ === 'RBNode_elm_builtin') && (dict.e.d.a.$ === 'Red')) {
			var clr = dict.a;
			var k = dict.b;
			var v = dict.c;
			var _v1 = dict.d;
			var lClr = _v1.a;
			var lK = _v1.b;
			var lV = _v1.c;
			var lLeft = _v1.d;
			var lRight = _v1.e;
			var _v2 = dict.e;
			var rClr = _v2.a;
			var rK = _v2.b;
			var rV = _v2.c;
			var rLeft = _v2.d;
			var _v3 = rLeft.a;
			var rlK = rLeft.b;
			var rlV = rLeft.c;
			var rlL = rLeft.d;
			var rlR = rLeft.e;
			var rRight = _v2.e;
			return A5(
				$elm$core$Dict$RBNode_elm_builtin,
				$elm$core$Dict$Red,
				rlK,
				rlV,
				A5(
					$elm$core$Dict$RBNode_elm_builtin,
					$elm$core$Dict$Black,
					k,
					v,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, lK, lV, lLeft, lRight),
					rlL),
				A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Black, rK, rV, rlR, rRight));
		} else {
			var clr = dict.a;
			var k = dict.b;
			var v = dict.c;
			var _v4 = dict.d;
			var lClr = _v4.a;
			var lK = _v4.b;
			var lV = _v4.c;
			var lLeft = _v4.d;
			var lRight = _v4.e;
			var _v5 = dict.e;
			var rClr = _v5.a;
			var rK = _v5.b;
			var rV = _v5.c;
			var rLeft = _v5.d;
			var rRight = _v5.e;
			if (clr.$ === 'Black') {
				return A5(
					$elm$core$Dict$RBNode_elm_builtin,
					$elm$core$Dict$Black,
					k,
					v,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, lK, lV, lLeft, lRight),
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, rK, rV, rLeft, rRight));
			} else {
				return A5(
					$elm$core$Dict$RBNode_elm_builtin,
					$elm$core$Dict$Black,
					k,
					v,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, lK, lV, lLeft, lRight),
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, rK, rV, rLeft, rRight));
			}
		}
	} else {
		return dict;
	}
};
var $elm$core$Dict$moveRedRight = function (dict) {
	if (((dict.$ === 'RBNode_elm_builtin') && (dict.d.$ === 'RBNode_elm_builtin')) && (dict.e.$ === 'RBNode_elm_builtin')) {
		if ((dict.d.d.$ === 'RBNode_elm_builtin') && (dict.d.d.a.$ === 'Red')) {
			var clr = dict.a;
			var k = dict.b;
			var v = dict.c;
			var _v1 = dict.d;
			var lClr = _v1.a;
			var lK = _v1.b;
			var lV = _v1.c;
			var _v2 = _v1.d;
			var _v3 = _v2.a;
			var llK = _v2.b;
			var llV = _v2.c;
			var llLeft = _v2.d;
			var llRight = _v2.e;
			var lRight = _v1.e;
			var _v4 = dict.e;
			var rClr = _v4.a;
			var rK = _v4.b;
			var rV = _v4.c;
			var rLeft = _v4.d;
			var rRight = _v4.e;
			return A5(
				$elm$core$Dict$RBNode_elm_builtin,
				$elm$core$Dict$Red,
				lK,
				lV,
				A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Black, llK, llV, llLeft, llRight),
				A5(
					$elm$core$Dict$RBNode_elm_builtin,
					$elm$core$Dict$Black,
					k,
					v,
					lRight,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, rK, rV, rLeft, rRight)));
		} else {
			var clr = dict.a;
			var k = dict.b;
			var v = dict.c;
			var _v5 = dict.d;
			var lClr = _v5.a;
			var lK = _v5.b;
			var lV = _v5.c;
			var lLeft = _v5.d;
			var lRight = _v5.e;
			var _v6 = dict.e;
			var rClr = _v6.a;
			var rK = _v6.b;
			var rV = _v6.c;
			var rLeft = _v6.d;
			var rRight = _v6.e;
			if (clr.$ === 'Black') {
				return A5(
					$elm$core$Dict$RBNode_elm_builtin,
					$elm$core$Dict$Black,
					k,
					v,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, lK, lV, lLeft, lRight),
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, rK, rV, rLeft, rRight));
			} else {
				return A5(
					$elm$core$Dict$RBNode_elm_builtin,
					$elm$core$Dict$Black,
					k,
					v,
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, lK, lV, lLeft, lRight),
					A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, rK, rV, rLeft, rRight));
			}
		}
	} else {
		return dict;
	}
};
var $elm$core$Dict$removeHelpPrepEQGT = F7(
	function (targetKey, dict, color, key, value, left, right) {
		if ((left.$ === 'RBNode_elm_builtin') && (left.a.$ === 'Red')) {
			var _v1 = left.a;
			var lK = left.b;
			var lV = left.c;
			var lLeft = left.d;
			var lRight = left.e;
			return A5(
				$elm$core$Dict$RBNode_elm_builtin,
				color,
				lK,
				lV,
				lLeft,
				A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Red, key, value, lRight, right));
		} else {
			_v2$2:
			while (true) {
				if ((right.$ === 'RBNode_elm_builtin') && (right.a.$ === 'Black')) {
					if (right.d.$ === 'RBNode_elm_builtin') {
						if (right.d.a.$ === 'Black') {
							var _v3 = right.a;
							var _v4 = right.d;
							var _v5 = _v4.a;
							return $elm$core$Dict$moveRedRight(dict);
						} else {
							break _v2$2;
						}
					} else {
						var _v6 = right.a;
						var _v7 = right.d;
						return $elm$core$Dict$moveRedRight(dict);
					}
				} else {
					break _v2$2;
				}
			}
			return dict;
		}
	});
var $elm$core$Dict$removeMin = function (dict) {
	if ((dict.$ === 'RBNode_elm_builtin') && (dict.d.$ === 'RBNode_elm_builtin')) {
		var color = dict.a;
		var key = dict.b;
		var value = dict.c;
		var left = dict.d;
		var lColor = left.a;
		var lLeft = left.d;
		var right = dict.e;
		if (lColor.$ === 'Black') {
			if ((lLeft.$ === 'RBNode_elm_builtin') && (lLeft.a.$ === 'Red')) {
				var _v3 = lLeft.a;
				return A5(
					$elm$core$Dict$RBNode_elm_builtin,
					color,
					key,
					value,
					$elm$core$Dict$removeMin(left),
					right);
			} else {
				var _v4 = $elm$core$Dict$moveRedLeft(dict);
				if (_v4.$ === 'RBNode_elm_builtin') {
					var nColor = _v4.a;
					var nKey = _v4.b;
					var nValue = _v4.c;
					var nLeft = _v4.d;
					var nRight = _v4.e;
					return A5(
						$elm$core$Dict$balance,
						nColor,
						nKey,
						nValue,
						$elm$core$Dict$removeMin(nLeft),
						nRight);
				} else {
					return $elm$core$Dict$RBEmpty_elm_builtin;
				}
			}
		} else {
			return A5(
				$elm$core$Dict$RBNode_elm_builtin,
				color,
				key,
				value,
				$elm$core$Dict$removeMin(left),
				right);
		}
	} else {
		return $elm$core$Dict$RBEmpty_elm_builtin;
	}
};
var $elm$core$Dict$removeHelp = F2(
	function (targetKey, dict) {
		if (dict.$ === 'RBEmpty_elm_builtin') {
			return $elm$core$Dict$RBEmpty_elm_builtin;
		} else {
			var color = dict.a;
			var key = dict.b;
			var value = dict.c;
			var left = dict.d;
			var right = dict.e;
			if (_Utils_cmp(targetKey, key) < 0) {
				if ((left.$ === 'RBNode_elm_builtin') && (left.a.$ === 'Black')) {
					var _v4 = left.a;
					var lLeft = left.d;
					if ((lLeft.$ === 'RBNode_elm_builtin') && (lLeft.a.$ === 'Red')) {
						var _v6 = lLeft.a;
						return A5(
							$elm$core$Dict$RBNode_elm_builtin,
							color,
							key,
							value,
							A2($elm$core$Dict$removeHelp, targetKey, left),
							right);
					} else {
						var _v7 = $elm$core$Dict$moveRedLeft(dict);
						if (_v7.$ === 'RBNode_elm_builtin') {
							var nColor = _v7.a;
							var nKey = _v7.b;
							var nValue = _v7.c;
							var nLeft = _v7.d;
							var nRight = _v7.e;
							return A5(
								$elm$core$Dict$balance,
								nColor,
								nKey,
								nValue,
								A2($elm$core$Dict$removeHelp, targetKey, nLeft),
								nRight);
						} else {
							return $elm$core$Dict$RBEmpty_elm_builtin;
						}
					}
				} else {
					return A5(
						$elm$core$Dict$RBNode_elm_builtin,
						color,
						key,
						value,
						A2($elm$core$Dict$removeHelp, targetKey, left),
						right);
				}
			} else {
				return A2(
					$elm$core$Dict$removeHelpEQGT,
					targetKey,
					A7($elm$core$Dict$removeHelpPrepEQGT, targetKey, dict, color, key, value, left, right));
			}
		}
	});
var $elm$core$Dict$removeHelpEQGT = F2(
	function (targetKey, dict) {
		if (dict.$ === 'RBNode_elm_builtin') {
			var color = dict.a;
			var key = dict.b;
			var value = dict.c;
			var left = dict.d;
			var right = dict.e;
			if (_Utils_eq(targetKey, key)) {
				var _v1 = $elm$core$Dict$getMin(right);
				if (_v1.$ === 'RBNode_elm_builtin') {
					var minKey = _v1.b;
					var minValue = _v1.c;
					return A5(
						$elm$core$Dict$balance,
						color,
						minKey,
						minValue,
						left,
						$elm$core$Dict$removeMin(right));
				} else {
					return $elm$core$Dict$RBEmpty_elm_builtin;
				}
			} else {
				return A5(
					$elm$core$Dict$balance,
					color,
					key,
					value,
					left,
					A2($elm$core$Dict$removeHelp, targetKey, right));
			}
		} else {
			return $elm$core$Dict$RBEmpty_elm_builtin;
		}
	});
var $elm$core$Dict$remove = F2(
	function (key, dict) {
		var _v0 = A2($elm$core$Dict$removeHelp, key, dict);
		if ((_v0.$ === 'RBNode_elm_builtin') && (_v0.a.$ === 'Red')) {
			var _v1 = _v0.a;
			var k = _v0.b;
			var v = _v0.c;
			var l = _v0.d;
			var r = _v0.e;
			return A5($elm$core$Dict$RBNode_elm_builtin, $elm$core$Dict$Black, k, v, l, r);
		} else {
			var x = _v0;
			return x;
		}
	});
var $elm$core$Dict$update = F3(
	function (targetKey, alter, dictionary) {
		var _v0 = alter(
			A2($elm$core$Dict$get, targetKey, dictionary));
		if (_v0.$ === 'Just') {
			var value = _v0.a;
			return A3($elm$core$Dict$insert, targetKey, value, dictionary);
		} else {
			return A2($elm$core$Dict$remove, targetKey, dictionary);
		}
	});
var $elm$core$Basics$composeR = F3(
	function (f, g, x) {
		return g(
			f(x));
	});
var $lynxjs_elm$http$Http$expectStringResponse = F2(
	function (toMsg, toResult) {
		return A3(
			_Http_expect,
			'',
			$elm$core$Basics$identity,
			A2($elm$core$Basics$composeR, toResult, toMsg));
	});
var $elm$core$Result$mapError = F2(
	function (f, result) {
		if (result.$ === 'Ok') {
			var v = result.a;
			return $elm$core$Result$Ok(v);
		} else {
			var e = result.a;
			return $elm$core$Result$Err(
				f(e));
		}
	});
var $lynxjs_elm$http$Http$BadBody = function (a) {
	return {$: 'BadBody', a: a};
};
var $lynxjs_elm$http$Http$BadStatus = function (a) {
	return {$: 'BadStatus', a: a};
};
var $lynxjs_elm$http$Http$BadUrl = function (a) {
	return {$: 'BadUrl', a: a};
};
var $lynxjs_elm$http$Http$NetworkError = {$: 'NetworkError'};
var $lynxjs_elm$http$Http$Timeout = {$: 'Timeout'};
var $lynxjs_elm$http$Http$resolve = F2(
	function (toResult, response) {
		switch (response.$) {
			case 'BadUrl_':
				var url = response.a;
				return $elm$core$Result$Err(
					$lynxjs_elm$http$Http$BadUrl(url));
			case 'Timeout_':
				return $elm$core$Result$Err($lynxjs_elm$http$Http$Timeout);
			case 'NetworkError_':
				return $elm$core$Result$Err($lynxjs_elm$http$Http$NetworkError);
			case 'BadStatus_':
				var metadata = response.a;
				return $elm$core$Result$Err(
					$lynxjs_elm$http$Http$BadStatus(metadata.statusCode));
			default:
				var body = response.b;
				return A2(
					$elm$core$Result$mapError,
					$lynxjs_elm$http$Http$BadBody,
					toResult(body));
		}
	});
var $lynxjs_elm$http$Http$expectJson = F2(
	function (toMsg, decoder) {
		return A2(
			$lynxjs_elm$http$Http$expectStringResponse,
			toMsg,
			$lynxjs_elm$http$Http$resolve(
				function (string) {
					return A2(
						$elm$core$Result$mapError,
						$elm$json$Json$Decode$errorToString,
						A2($elm$json$Json$Decode$decodeString, decoder, string));
				}));
	});
var $elm$json$Json$Decode$field = _Json_decodeField;
var $lynxjs_elm$http$Http$Header = F2(
	function (a, b) {
		return {$: 'Header', a: a, b: b};
	});
var $lynxjs_elm$http$Http$header = $lynxjs_elm$http$Http$Header;
var $lynxjs_elm$http$Http$jsonBody = function (value) {
	return A2(
		_Http_pair,
		'application/json',
		A2($elm$json$Json$Encode$encode, 0, value));
};
var $elm$json$Json$Encode$list = F2(
	function (func, entries) {
		return _Json_wrap(
			A3(
				$elm$core$List$foldl,
				_Json_addEntry(func),
				_Json_emptyArray(_Utils_Tuple0),
				entries));
	});
var $elm$json$Json$Encode$object = function (pairs) {
	return _Json_wrap(
		A3(
			$elm$core$List$foldl,
			F2(
				function (_v0, obj) {
					var k = _v0.a;
					var v = _v0.b;
					return A3(_Json_addField, k, v, obj);
				}),
			_Json_emptyObject(_Utils_Tuple0),
			pairs));
};
var $lynxjs_elm$http$Http$Request = function (a) {
	return {$: 'Request', a: a};
};
var $lynxjs_elm$http$Http$State = F2(
	function (reqs, subs) {
		return {reqs: reqs, subs: subs};
	});
var $lynxjs_elm$http$Http$init = $elm$core$Task$succeed(
	A2($lynxjs_elm$http$Http$State, $elm$core$Dict$empty, _List_Nil));
var $lynxjs_elm$http$Http$updateReqs = F3(
	function (router, cmds, reqs) {
		updateReqs:
		while (true) {
			if (!cmds.b) {
				return $elm$core$Task$succeed(reqs);
			} else {
				var cmd = cmds.a;
				var otherCmds = cmds.b;
				if (cmd.$ === 'Cancel') {
					var tracker = cmd.a;
					var _v2 = A2($elm$core$Dict$get, tracker, reqs);
					if (_v2.$ === 'Nothing') {
						var $temp$router = router,
							$temp$cmds = otherCmds,
							$temp$reqs = reqs;
						router = $temp$router;
						cmds = $temp$cmds;
						reqs = $temp$reqs;
						continue updateReqs;
					} else {
						var pid = _v2.a;
						return A2(
							$elm$core$Task$andThen,
							function (_v3) {
								return A3(
									$lynxjs_elm$http$Http$updateReqs,
									router,
									otherCmds,
									A2($elm$core$Dict$remove, tracker, reqs));
							},
							$elm$core$Process$kill(pid));
					}
				} else {
					var req = cmd.a;
					return A2(
						$elm$core$Task$andThen,
						function (pid) {
							var _v4 = req.tracker;
							if (_v4.$ === 'Nothing') {
								return A3($lynxjs_elm$http$Http$updateReqs, router, otherCmds, reqs);
							} else {
								var tracker = _v4.a;
								return A3(
									$lynxjs_elm$http$Http$updateReqs,
									router,
									otherCmds,
									A3($elm$core$Dict$insert, tracker, pid, reqs));
							}
						},
						$elm$core$Process$spawn(
							A3(
								_Http_toTask,
								router,
								$elm$core$Platform$sendToApp(router),
								req)));
				}
			}
		}
	});
var $lynxjs_elm$http$Http$onEffects = F4(
	function (router, cmds, subs, state) {
		return A2(
			$elm$core$Task$andThen,
			function (reqs) {
				return $elm$core$Task$succeed(
					A2($lynxjs_elm$http$Http$State, reqs, subs));
			},
			A3($lynxjs_elm$http$Http$updateReqs, router, cmds, state.reqs));
	});
var $elm$core$List$maybeCons = F3(
	function (f, mx, xs) {
		var _v0 = f(mx);
		if (_v0.$ === 'Just') {
			var x = _v0.a;
			return A2($elm$core$List$cons, x, xs);
		} else {
			return xs;
		}
	});
var $elm$core$List$filterMap = F2(
	function (f, xs) {
		return A3(
			$elm$core$List$foldr,
			$elm$core$List$maybeCons(f),
			_List_Nil,
			xs);
	});
var $lynxjs_elm$http$Http$maybeSend = F4(
	function (router, desiredTracker, progress, _v0) {
		var actualTracker = _v0.a;
		var toMsg = _v0.b;
		return _Utils_eq(desiredTracker, actualTracker) ? $elm$core$Maybe$Just(
			A2(
				$elm$core$Platform$sendToApp,
				router,
				toMsg(progress))) : $elm$core$Maybe$Nothing;
	});
var $lynxjs_elm$http$Http$onSelfMsg = F3(
	function (router, _v0, state) {
		var tracker = _v0.a;
		var progress = _v0.b;
		return A2(
			$elm$core$Task$andThen,
			function (_v1) {
				return $elm$core$Task$succeed(state);
			},
			$elm$core$Task$sequence(
				A2(
					$elm$core$List$filterMap,
					A3($lynxjs_elm$http$Http$maybeSend, router, tracker, progress),
					state.subs)));
	});
var $lynxjs_elm$http$Http$Cancel = function (a) {
	return {$: 'Cancel', a: a};
};
var $lynxjs_elm$http$Http$cmdMap = F2(
	function (func, cmd) {
		if (cmd.$ === 'Cancel') {
			var tracker = cmd.a;
			return $lynxjs_elm$http$Http$Cancel(tracker);
		} else {
			var r = cmd.a;
			return $lynxjs_elm$http$Http$Request(
				{
					allowCookiesFromOtherDomains: r.allowCookiesFromOtherDomains,
					body: r.body,
					expect: A2(_Http_mapExpect, func, r.expect),
					headers: r.headers,
					method: r.method,
					timeout: r.timeout,
					tracker: r.tracker,
					url: r.url
				});
		}
	});
var $lynxjs_elm$http$Http$MySub = F2(
	function (a, b) {
		return {$: 'MySub', a: a, b: b};
	});
var $lynxjs_elm$http$Http$subMap = F2(
	function (func, _v0) {
		var tracker = _v0.a;
		var toMsg = _v0.b;
		return A2(
			$lynxjs_elm$http$Http$MySub,
			tracker,
			A2($elm$core$Basics$composeR, toMsg, func));
	});
_Platform_effectManagers['Http'] = _Platform_createManager($lynxjs_elm$http$Http$init, $lynxjs_elm$http$Http$onEffects, $lynxjs_elm$http$Http$onSelfMsg, $lynxjs_elm$http$Http$cmdMap, $lynxjs_elm$http$Http$subMap);
var $lynxjs_elm$http$Http$command = _Platform_leaf('Http');
var $lynxjs_elm$http$Http$subscription = _Platform_leaf('Http');
var $lynxjs_elm$http$Http$request = function (r) {
	return $lynxjs_elm$http$Http$command(
		$lynxjs_elm$http$Http$Request(
			{allowCookiesFromOtherDomains: false, body: r.body, expect: r.expect, headers: r.headers, method: r.method, timeout: r.timeout, tracker: r.tracker, url: r.url}));
};
var $elm$json$Json$Encode$string = _Json_wrap;
var $author$project$Main$ackMessages = F3(
	function (serverUrl, token, messageIds) {
		return $lynxjs_elm$http$Http$request(
			{
				body: $lynxjs_elm$http$Http$jsonBody(
					$elm$json$Json$Encode$object(
						_List_fromArray(
							[
								_Utils_Tuple2(
								'messageIds',
								A2($elm$json$Json$Encode$list, $elm$json$Json$Encode$string, messageIds))
							]))),
				expect: A2(
					$lynxjs_elm$http$Http$expectJson,
					$author$project$Main$GotAck,
					A2($elm$json$Json$Decode$field, 'ok', $elm$json$Json$Decode$bool)),
				headers: _List_fromArray(
					[
						A2($lynxjs_elm$http$Http$header, 'Authorization', 'Bearer ' + token)
					]),
				method: 'POST',
				timeout: $elm$core$Maybe$Just(5000),
				tracker: $elm$core$Maybe$Nothing,
				url: serverUrl + '/messages/ack'
			});
	});
var $lynxjs_elm$crypto$Crypto$X25519$getPublicKey = _Crypto_x25519GetPublicKey;
var $lynxjs_elm$crypto$Crypto$X25519$getSharedSecret = _Crypto_x25519GetSharedSecret;
var $lynxjs_elm$crypto$Crypto$Cipher$keyFromHex = _Crypto_cipherKeyFromHex;
var $lynxjs_elm$crypto$Crypto$Cipher$nonce24FromHex = _Crypto_cipherNonce24FromHex;
var $lynxjs_elm$crypto$Crypto$X25519$privateKeyFromHex = _Crypto_x25519PrivateKeyFromHex;
var $lynxjs_elm$crypto$Crypto$X25519$publicKeyFromHex = _Crypto_x25519PublicKeyFromHex;
var $lynxjs_elm$crypto$Crypto$Ed25519$publicKeyToHex = _Crypto_ed25519PublicKeyToHex;
var $lynxjs_elm$crypto$Crypto$X25519$publicKeyToHex = _Crypto_x25519PublicKeyToHex;
var $lynxjs_elm$crypto$Crypto$Ed25519$sign = _Crypto_ed25519Sign;
var $lynxjs_elm$crypto$Crypto$Ed25519$signatureToHex = _Crypto_ed25519SignatureToHex;
var $elm$core$Basics$modBy = _Basics_modBy;
var $author$project$Main$nibbleToHex = function (n) {
	switch (n) {
		case 0:
			return _Utils_chr('0');
		case 1:
			return _Utils_chr('1');
		case 2:
			return _Utils_chr('2');
		case 3:
			return _Utils_chr('3');
		case 4:
			return _Utils_chr('4');
		case 5:
			return _Utils_chr('5');
		case 6:
			return _Utils_chr('6');
		case 7:
			return _Utils_chr('7');
		case 8:
			return _Utils_chr('8');
		case 9:
			return _Utils_chr('9');
		case 10:
			return _Utils_chr('a');
		case 11:
			return _Utils_chr('b');
		case 12:
			return _Utils_chr('c');
		case 13:
			return _Utils_chr('d');
		case 14:
			return _Utils_chr('e');
		default:
			return _Utils_chr('f');
	}
};
var $author$project$Main$charToHexBytes = function (c) {
	var code = $elm$core$Char$toCode(c);
	if (code < 128) {
		return _List_fromArray(
			[
				$author$project$Main$nibbleToHex((code / 16) | 0),
				$author$project$Main$nibbleToHex(
				A2($elm$core$Basics$modBy, 16, code))
			]);
	} else {
		if (code < 2048) {
			var b2 = 128 + A2($elm$core$Basics$modBy, 64, code);
			var b1 = 192 + ((code / 64) | 0);
			return _List_fromArray(
				[
					$author$project$Main$nibbleToHex((b1 / 16) | 0),
					$author$project$Main$nibbleToHex(
					A2($elm$core$Basics$modBy, 16, b1)),
					$author$project$Main$nibbleToHex((b2 / 16) | 0),
					$author$project$Main$nibbleToHex(
					A2($elm$core$Basics$modBy, 16, b2))
				]);
		} else {
			if (code < 65536) {
				var b3 = 128 + A2($elm$core$Basics$modBy, 64, code);
				var b2 = 128 + A2($elm$core$Basics$modBy, 64, (code / 64) | 0);
				var b1 = 224 + ((code / 4096) | 0);
				return _List_fromArray(
					[
						$author$project$Main$nibbleToHex((b1 / 16) | 0),
						$author$project$Main$nibbleToHex(
						A2($elm$core$Basics$modBy, 16, b1)),
						$author$project$Main$nibbleToHex((b2 / 16) | 0),
						$author$project$Main$nibbleToHex(
						A2($elm$core$Basics$modBy, 16, b2)),
						$author$project$Main$nibbleToHex((b3 / 16) | 0),
						$author$project$Main$nibbleToHex(
						A2($elm$core$Basics$modBy, 16, b3))
					]);
			} else {
				var b4 = 128 + A2($elm$core$Basics$modBy, 64, code);
				var b3 = 128 + A2($elm$core$Basics$modBy, 64, (code / 64) | 0);
				var b2 = 128 + A2($elm$core$Basics$modBy, 64, (code / 4096) | 0);
				var b1 = 240 + ((code / 262144) | 0);
				return _List_fromArray(
					[
						$author$project$Main$nibbleToHex((b1 / 16) | 0),
						$author$project$Main$nibbleToHex(
						A2($elm$core$Basics$modBy, 16, b1)),
						$author$project$Main$nibbleToHex((b2 / 16) | 0),
						$author$project$Main$nibbleToHex(
						A2($elm$core$Basics$modBy, 16, b2)),
						$author$project$Main$nibbleToHex((b3 / 16) | 0),
						$author$project$Main$nibbleToHex(
						A2($elm$core$Basics$modBy, 16, b3)),
						$author$project$Main$nibbleToHex((b4 / 16) | 0),
						$author$project$Main$nibbleToHex(
						A2($elm$core$Basics$modBy, 16, b4))
					]);
			}
		}
	}
};
var $elm$core$List$append = F2(
	function (xs, ys) {
		if (!ys.b) {
			return xs;
		} else {
			return A3($elm$core$List$foldr, $elm$core$List$cons, ys, xs);
		}
	});
var $elm$core$List$concat = function (lists) {
	return A3($elm$core$List$foldr, $elm$core$List$append, _List_Nil, lists);
};
var $elm$core$List$concatMap = F2(
	function (f, list) {
		return $elm$core$List$concat(
			A2($elm$core$List$map, f, list));
	});
var $elm$core$String$foldr = _String_foldr;
var $elm$core$String$toList = function (string) {
	return A3($elm$core$String$foldr, $elm$core$List$cons, _List_Nil, string);
};
var $author$project$Main$textToHex = function (str) {
	return $elm$core$String$fromList(
		A2(
			$elm$core$List$concatMap,
			$author$project$Main$charToHexBytes,
			$elm$core$String$toList(str)));
};
var $lynxjs_elm$crypto$Crypto$Cipher$xchacha20Encrypt = _Crypto_xchacha20Encrypt;
var $author$project$Main$encryptMessage = F6(
	function (edPriv, edPub, recipientXPubHex, ephSeedHex, nonceHex, plaintextJson) {
		var _v0 = _Utils_Tuple3(
			$lynxjs_elm$crypto$Crypto$X25519$privateKeyFromHex(ephSeedHex),
			$lynxjs_elm$crypto$Crypto$X25519$publicKeyFromHex(recipientXPubHex),
			$lynxjs_elm$crypto$Crypto$Cipher$nonce24FromHex(nonceHex));
		if (((_v0.a.$ === 'Just') && (_v0.b.$ === 'Just')) && (_v0.c.$ === 'Just')) {
			var ephPriv = _v0.a.a;
			var recipientXPub = _v0.b.a;
			var nonce = _v0.c.a;
			var sharedSecretHex = A2($lynxjs_elm$crypto$Crypto$X25519$getSharedSecret, ephPriv, recipientXPub);
			var ephPub = $lynxjs_elm$crypto$Crypto$X25519$getPublicKey(ephPriv);
			var ephPubHex = $lynxjs_elm$crypto$Crypto$X25519$publicKeyToHex(ephPub);
			var _v1 = $lynxjs_elm$crypto$Crypto$Cipher$keyFromHex(sharedSecretHex);
			if (_v1.$ === 'Just') {
				var key = _v1.a;
				var senderPubHex = $lynxjs_elm$crypto$Crypto$Ed25519$publicKeyToHex(edPub);
				var plaintextHex = $author$project$Main$textToHex(plaintextJson);
				var ciphertextHex = A3($lynxjs_elm$crypto$Crypto$Cipher$xchacha20Encrypt, key, nonce, plaintextHex);
				var sig = A2($lynxjs_elm$crypto$Crypto$Ed25519$sign, ciphertextHex, edPriv);
				var sigHex = $lynxjs_elm$crypto$Crypto$Ed25519$signatureToHex(sig);
				return $elm$core$Maybe$Just(
					_Utils_ap(
						ephPubHex,
						_Utils_ap(
							nonceHex,
							_Utils_ap(
								ciphertextHex,
								_Utils_ap(senderPubHex, sigHex)))));
			} else {
				return $elm$core$Maybe$Nothing;
			}
		} else {
			return $elm$core$Maybe$Nothing;
		}
	});
var $lynxjs_elm$crypto$Crypto$Ed25519$getPublicKey = _Crypto_ed25519GetPublicKey;
var $author$project$Main$httpErrorToString = function (err) {
	switch (err.$) {
		case 'BadUrl':
			var url = err.a;
			return 'Bad URL: ' + url;
		case 'Timeout':
			return 'Request timed out';
		case 'NetworkError':
			return 'Network error';
		case 'BadStatus':
			var code = err.a;
			return 'Server error: ' + $elm$core$String$fromInt(code);
		default:
			var msg_ = err.a;
			return 'Bad response: ' + msg_;
	}
};
var $elm$json$Json$Encode$int = _Json_wrap;
var $elm$core$List$isEmpty = function (xs) {
	if (!xs.b) {
		return true;
	} else {
		return false;
	}
};
var $elm$core$String$isEmpty = function (string) {
	return string === '';
};
var $elm$core$String$slice = _String_slice;
var $elm$core$String$left = F2(
	function (n, string) {
		return (n < 1) ? '' : A3($elm$core$String$slice, 0, n, string);
	});
var $author$project$Main$GotLookup = function (a) {
	return {$: 'GotLookup', a: a};
};
var $lynxjs_elm$http$Http$emptyBody = _Http_emptyBody;
var $lynxjs_elm$http$Http$get = function (r) {
	return $lynxjs_elm$http$Http$request(
		{body: $lynxjs_elm$http$Http$emptyBody, expect: r.expect, headers: _List_Nil, method: 'GET', timeout: $elm$core$Maybe$Nothing, tracker: $elm$core$Maybe$Nothing, url: r.url});
};
var $author$project$Main$LookupResponse = F2(
	function (pubkey, online) {
		return {online: online, pubkey: pubkey};
	});
var $author$project$Main$lookupDecoder = function (pubkey) {
	return A2(
		$elm$json$Json$Decode$map,
		$author$project$Main$LookupResponse(pubkey),
		A2($elm$json$Json$Decode$field, 'online', $elm$json$Json$Decode$bool));
};
var $author$project$Main$lookupPresence = F2(
	function (serverUrl, pubkey) {
		return $lynxjs_elm$http$Http$get(
			{
				expect: A2(
					$lynxjs_elm$http$Http$expectJson,
					$author$project$Main$GotLookup,
					$author$project$Main$lookupDecoder(pubkey)),
				url: serverUrl + ('/lookup/' + pubkey)
			});
	});
var $elm$core$Maybe$map = F2(
	function (f, maybe) {
		if (maybe.$ === 'Just') {
			var value = maybe.a;
			return $elm$core$Maybe$Just(
				f(value));
		} else {
			return $elm$core$Maybe$Nothing;
		}
	});
var $elm$core$Platform$Cmd$batch = _Platform_batch;
var $elm$core$Platform$Cmd$none = $elm$core$Platform$Cmd$batch(_List_Nil);
var $elm$core$String$length = _String_length;
var $author$project$Main$parseIdentity = function (str) {
	var _v0 = A2($elm$core$String$split, '.', str);
	if ((_v0.b && _v0.b.b) && (!_v0.b.b.b)) {
		var edHex = _v0.a;
		var _v1 = _v0.b;
		var xHex = _v1.a;
		return (($elm$core$String$length(edHex) === 64) && ($elm$core$String$length(xHex) === 64)) ? $elm$core$Maybe$Just(
			_Utils_Tuple2(edHex, xHex)) : $elm$core$Maybe$Nothing;
	} else {
		return $elm$core$Maybe$Nothing;
	}
};
var $author$project$Main$GotPoll = function (a) {
	return {$: 'GotPoll', a: a};
};
var $author$project$Main$PollResponse = F2(
	function (events, cursor) {
		return {cursor: cursor, events: events};
	});
var $elm$json$Json$Decode$list = _Json_decodeList;
var $author$project$Main$PollEvent = F3(
	function (id, eventType, payload) {
		return {eventType: eventType, id: id, payload: payload};
	});
var $elm$json$Json$Decode$map3 = _Json_map3;
var $elm$json$Json$Decode$string = _Json_decodeString;
var $author$project$Main$pollEventDecoder = A4(
	$elm$json$Json$Decode$map3,
	$author$project$Main$PollEvent,
	A2($elm$json$Json$Decode$field, 'id', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'eventType', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'payload', $elm$json$Json$Decode$string));
var $author$project$Main$pollDecoder = A3(
	$elm$json$Json$Decode$map2,
	$author$project$Main$PollResponse,
	A2(
		$elm$json$Json$Decode$field,
		'events',
		$elm$json$Json$Decode$list($author$project$Main$pollEventDecoder)),
	A2($elm$json$Json$Decode$field, 'cursor', $elm$json$Json$Decode$string));
var $author$project$Main$pollMessages = F2(
	function (serverUrl, token) {
		return $lynxjs_elm$http$Http$request(
			{
				body: $lynxjs_elm$http$Http$emptyBody,
				expect: A2($lynxjs_elm$http$Http$expectJson, $author$project$Main$GotPoll, $author$project$Main$pollDecoder),
				headers: _List_fromArray(
					[
						A2($lynxjs_elm$http$Http$header, 'Authorization', 'Bearer ' + token)
					]),
				method: 'GET',
				timeout: $elm$core$Maybe$Just(10000),
				tracker: $elm$core$Maybe$Nothing,
				url: serverUrl + '/poll'
			});
	});
var $lynxjs_elm$crypto$Crypto$Ed25519$privateKeyFromHex = _Crypto_ed25519PrivateKeyFromHex;
var $elm$core$Basics$ge = _Utils_ge;
var $author$project$Main$decodeUtf8Help = F2(
	function (bytes, acc) {
		decodeUtf8Help:
		while (true) {
			if (!bytes.b) {
				return $elm$core$Maybe$Just(acc);
			} else {
				var b = bytes.a;
				var rest = bytes.b;
				if (b < 128) {
					var $temp$bytes = rest,
						$temp$acc = A2(
						$elm$core$List$cons,
						$elm$core$Char$fromCode(b),
						acc);
					bytes = $temp$bytes;
					acc = $temp$acc;
					continue decodeUtf8Help;
				} else {
					if ((b >= 192) && (b < 224)) {
						if (rest.b) {
							var b2 = rest.a;
							var rest2 = rest.b;
							var code = ((b - 192) * 64) + (b2 - 128);
							var $temp$bytes = rest2,
								$temp$acc = A2(
								$elm$core$List$cons,
								$elm$core$Char$fromCode(code),
								acc);
							bytes = $temp$bytes;
							acc = $temp$acc;
							continue decodeUtf8Help;
						} else {
							return $elm$core$Maybe$Nothing;
						}
					} else {
						if ((b >= 224) && (b < 240)) {
							if (rest.b && rest.b.b) {
								var b2 = rest.a;
								var _v3 = rest.b;
								var b3 = _v3.a;
								var rest3 = _v3.b;
								var code = (((b - 224) * 4096) + ((b2 - 128) * 64)) + (b3 - 128);
								var $temp$bytes = rest3,
									$temp$acc = A2(
									$elm$core$List$cons,
									$elm$core$Char$fromCode(code),
									acc);
								bytes = $temp$bytes;
								acc = $temp$acc;
								continue decodeUtf8Help;
							} else {
								return $elm$core$Maybe$Nothing;
							}
						} else {
							if (b >= 240) {
								if ((rest.b && rest.b.b) && rest.b.b.b) {
									var b2 = rest.a;
									var _v5 = rest.b;
									var b3 = _v5.a;
									var _v6 = _v5.b;
									var b4 = _v6.a;
									var rest4 = _v6.b;
									var code = ((((b - 240) * 262144) + ((b2 - 128) * 4096)) + ((b3 - 128) * 64)) + (b4 - 128);
									var $temp$bytes = rest4,
										$temp$acc = A2(
										$elm$core$List$cons,
										$elm$core$Char$fromCode(code),
										acc);
									bytes = $temp$bytes;
									acc = $temp$acc;
									continue decodeUtf8Help;
								} else {
									return $elm$core$Maybe$Nothing;
								}
							} else {
								return $elm$core$Maybe$Nothing;
							}
						}
					}
				}
			}
		}
	});
var $author$project$Main$decodeUtf8Bytes = function (bytes) {
	return A2(
		$elm$core$Maybe$map,
		A2($elm$core$Basics$composeR, $elm$core$List$reverse, $elm$core$String$fromList),
		A2($author$project$Main$decodeUtf8Help, bytes, _List_Nil));
};
var $author$project$Main$hexCharToInt = function (c) {
	var code = $elm$core$Char$toCode(c);
	return ((code >= 48) && (code <= 57)) ? $elm$core$Maybe$Just(code - 48) : (((code >= 97) && (code <= 102)) ? $elm$core$Maybe$Just(code - 87) : (((code >= 65) && (code <= 70)) ? $elm$core$Maybe$Just(code - 55) : $elm$core$Maybe$Nothing));
};
var $elm$core$Maybe$map2 = F3(
	function (func, ma, mb) {
		if (ma.$ === 'Nothing') {
			return $elm$core$Maybe$Nothing;
		} else {
			var a = ma.a;
			if (mb.$ === 'Nothing') {
				return $elm$core$Maybe$Nothing;
			} else {
				var b = mb.a;
				return $elm$core$Maybe$Just(
					A2(func, a, b));
			}
		}
	});
var $author$project$Main$pairUp = function (list) {
	if (list.b && list.b.b) {
		var a = list.a;
		var _v1 = list.b;
		var b = _v1.a;
		var rest = _v1.b;
		return A2(
			$elm$core$List$cons,
			_Utils_Tuple2(a, b),
			$author$project$Main$pairUp(rest));
	} else {
		return _List_Nil;
	}
};
var $author$project$Main$hexToBytes = function (hex) {
	var chars = $elm$core$String$toList(hex);
	var pairs = $author$project$Main$pairUp(chars);
	return A2(
		$elm$core$List$filterMap,
		function (_v0) {
			var hi = _v0.a;
			var lo = _v0.b;
			return A3(
				$elm$core$Maybe$map2,
				F2(
					function (h, l) {
						return (h * 16) + l;
					}),
				$author$project$Main$hexCharToInt(hi),
				$author$project$Main$hexCharToInt(lo));
		},
		pairs);
};
var $elm$core$Maybe$withDefault = F2(
	function (_default, maybe) {
		if (maybe.$ === 'Just') {
			var value = maybe.a;
			return value;
		} else {
			return _default;
		}
	});
var $author$project$Main$hexToText = function (hex) {
	return A2(
		$elm$core$Maybe$withDefault,
		'',
		$author$project$Main$decodeUtf8Bytes(
			$author$project$Main$hexToBytes(hex)));
};
var $elm$core$Basics$not = _Basics_not;
var $lynxjs_elm$crypto$Crypto$Ed25519$publicKeyFromHex = _Crypto_ed25519PublicKeyFromHex;
var $lynxjs_elm$crypto$Crypto$Ed25519$signatureFromHex = _Crypto_ed25519SignatureFromHex;
var $lynxjs_elm$crypto$Crypto$Ed25519$verify = _Crypto_ed25519Verify;
var $lynxjs_elm$crypto$Crypto$Cipher$xchacha20Decrypt = _Crypto_xchacha20Decrypt;
var $author$project$Main$decryptMessage = F2(
	function (xPriv, blob) {
		var hexLen = $elm$core$String$length(blob);
		if (hexLen < 304) {
			return $elm$core$Maybe$Nothing;
		} else {
			var sigHex = A3($elm$core$String$slice, hexLen - 128, hexLen, blob);
			var senderEdPubHex = A3($elm$core$String$slice, hexLen - 192, hexLen - 128, blob);
			var nonceHex = A3($elm$core$String$slice, 64, 112, blob);
			var ephPubHex = A3($elm$core$String$slice, 0, 64, blob);
			var ciphertextHex = A3($elm$core$String$slice, 112, hexLen - 192, blob);
			var _v0 = _Utils_Tuple2(
				$lynxjs_elm$crypto$Crypto$Ed25519$publicKeyFromHex(senderEdPubHex),
				$lynxjs_elm$crypto$Crypto$Ed25519$signatureFromHex(sigHex));
			if ((_v0.a.$ === 'Just') && (_v0.b.$ === 'Just')) {
				var senderEdPub = _v0.a.a;
				var sig = _v0.b.a;
				if (!A3($lynxjs_elm$crypto$Crypto$Ed25519$verify, sig, ciphertextHex, senderEdPub)) {
					return $elm$core$Maybe$Nothing;
				} else {
					var _v1 = _Utils_Tuple2(
						$lynxjs_elm$crypto$Crypto$X25519$publicKeyFromHex(ephPubHex),
						$lynxjs_elm$crypto$Crypto$Cipher$nonce24FromHex(nonceHex));
					if ((_v1.a.$ === 'Just') && (_v1.b.$ === 'Just')) {
						var ephPub = _v1.a.a;
						var nonce = _v1.b.a;
						var sharedSecretHex = A2($lynxjs_elm$crypto$Crypto$X25519$getSharedSecret, xPriv, ephPub);
						var _v2 = $lynxjs_elm$crypto$Crypto$Cipher$keyFromHex(sharedSecretHex);
						if (_v2.$ === 'Just') {
							var key = _v2.a;
							var _v3 = A3($lynxjs_elm$crypto$Crypto$Cipher$xchacha20Decrypt, key, nonce, ciphertextHex);
							if (_v3.$ === 'Just') {
								var plaintextHex = _v3.a;
								return $elm$core$Maybe$Just(
									_Utils_Tuple2(
										senderEdPubHex,
										$author$project$Main$hexToText(plaintextHex)));
							} else {
								return $elm$core$Maybe$Nothing;
							}
						} else {
							return $elm$core$Maybe$Nothing;
						}
					} else {
						return $elm$core$Maybe$Nothing;
					}
				}
			} else {
				return $elm$core$Maybe$Nothing;
			}
		}
	});
var $author$project$Main$Envelope = F4(
	function (toKey, fromKey, encryptedBlob, timestamp) {
		return {encryptedBlob: encryptedBlob, fromKey: fromKey, timestamp: timestamp, toKey: toKey};
	});
var $elm$json$Json$Decode$int = _Json_decodeInt;
var $elm$json$Json$Decode$map4 = _Json_map4;
var $author$project$Main$envelopeDecoder = A5(
	$elm$json$Json$Decode$map4,
	$author$project$Main$Envelope,
	A2($elm$json$Json$Decode$field, 'toKey', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'fromKey', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'encryptedBlob', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'timestamp', $elm$json$Json$Decode$int));
var $elm$core$Set$insert = F2(
	function (key, _v0) {
		var dict = _v0.a;
		return $elm$core$Set$Set_elm_builtin(
			A3($elm$core$Dict$insert, key, _Utils_Tuple0, dict));
	});
var $elm$core$Dict$member = F2(
	function (key, dict) {
		var _v0 = A2($elm$core$Dict$get, key, dict);
		if (_v0.$ === 'Just') {
			return true;
		} else {
			return false;
		}
	});
var $elm$core$Set$member = F2(
	function (key, _v0) {
		var dict = _v0.a;
		return A2($elm$core$Dict$member, key, dict);
	});
var $author$project$Main$MessagePayload = F4(
	function (type_, id, timestamp, body) {
		return {body: body, id: id, timestamp: timestamp, type_: type_};
	});
var $author$project$Main$messagePayloadDecoder = A5(
	$elm$json$Json$Decode$map4,
	$author$project$Main$MessagePayload,
	A2($elm$json$Json$Decode$field, 'type', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'id', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'timestamp', $elm$json$Json$Decode$int),
	A2($elm$json$Json$Decode$field, 'body', $elm$json$Json$Decode$string));
var $author$project$Main$processEvents = F4(
	function (xPriv, myEdHex, events, seenIds) {
		return function (_v5) {
			var msgs = _v5.a;
			var seen = _v5.b;
			var acks = _v5.c;
			return _Utils_Tuple3(
				$elm$core$List$reverse(msgs),
				seen,
				acks);
		}(
			A3(
				$elm$core$List$foldl,
				F2(
					function (event, _v0) {
						var msgs = _v0.a;
						var seen = _v0.b;
						var acks = _v0.c;
						if (event.eventType !== 'message') {
							return _Utils_Tuple3(msgs, seen, acks);
						} else {
							var _v1 = A2($elm$json$Json$Decode$decodeString, $author$project$Main$envelopeDecoder, event.payload);
							if (_v1.$ === 'Err') {
								return _Utils_Tuple3(
									msgs,
									seen,
									A2($elm$core$List$cons, event.id, acks));
							} else {
								var envelope = _v1.a;
								if (_Utils_eq(envelope.fromKey, myEdHex)) {
									return _Utils_Tuple3(
										msgs,
										seen,
										A2($elm$core$List$cons, event.id, acks));
								} else {
									var _v2 = A2($author$project$Main$decryptMessage, xPriv, envelope.encryptedBlob);
									if (_v2.$ === 'Nothing') {
										return _Utils_Tuple3(
											msgs,
											seen,
											A2($elm$core$List$cons, event.id, acks));
									} else {
										var _v3 = _v2.a;
										var senderPub = _v3.a;
										var json = _v3.b;
										var _v4 = A2($elm$json$Json$Decode$decodeString, $author$project$Main$messagePayloadDecoder, json);
										if (_v4.$ === 'Err') {
											return _Utils_Tuple3(
												msgs,
												seen,
												A2($elm$core$List$cons, event.id, acks));
										} else {
											var payload = _v4.a;
											return A2($elm$core$Set$member, payload.id, seen) ? _Utils_Tuple3(
												msgs,
												seen,
												A2($elm$core$List$cons, event.id, acks)) : _Utils_Tuple3(
												A2(
													$elm$core$List$cons,
													_Utils_Tuple2(
														senderPub,
														{body: payload.body, id: payload.id, outgoing: false, timestamp: payload.timestamp}),
													msgs),
												A2($elm$core$Set$insert, payload.id, seen),
												A2($elm$core$List$cons, event.id, acks));
										}
									}
								}
							}
						}
					}),
				_Utils_Tuple3(_List_Nil, seenIds, _List_Nil),
				events));
	});
var $author$project$Main$GotChallenge = function (a) {
	return {$: 'GotChallenge', a: a};
};
var $author$project$Main$ChallengeResponse = function (challenge) {
	return {challenge: challenge};
};
var $author$project$Main$challengeDecoder = A2(
	$elm$json$Json$Decode$map,
	$author$project$Main$ChallengeResponse,
	A2($elm$json$Json$Decode$field, 'challenge', $elm$json$Json$Decode$string));
var $lynxjs_elm$http$Http$post = function (r) {
	return $lynxjs_elm$http$Http$request(
		{body: r.body, expect: r.expect, headers: _List_Nil, method: 'POST', timeout: $elm$core$Maybe$Nothing, tracker: $elm$core$Maybe$Nothing, url: r.url});
};
var $author$project$Main$requestChallenge = F2(
	function (serverUrl, pubkey) {
		return $lynxjs_elm$http$Http$post(
			{
				body: $lynxjs_elm$http$Http$jsonBody(
					$elm$json$Json$Encode$object(
						_List_fromArray(
							[
								_Utils_Tuple2(
								'pubkey',
								$elm$json$Json$Encode$string(pubkey))
							]))),
				expect: A2($lynxjs_elm$http$Http$expectJson, $author$project$Main$GotChallenge, $author$project$Main$challengeDecoder),
				url: serverUrl + '/auth/challenge'
			});
	});
var $author$project$Main$GotSendResult = function (a) {
	return {$: 'GotSendResult', a: a};
};
var $author$project$Main$SendResponse = F2(
	function (status, messageId) {
		return {messageId: messageId, status: status};
	});
var $author$project$Main$sendDecoder = A3(
	$elm$json$Json$Decode$map2,
	$author$project$Main$SendResponse,
	A2($elm$json$Json$Decode$field, 'status', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'messageId', $elm$json$Json$Decode$string));
var $author$project$Main$sendMessageHttp = F5(
	function (serverUrl, token, to, encryptedBlob, timestamp) {
		return $lynxjs_elm$http$Http$request(
			{
				body: $lynxjs_elm$http$Http$jsonBody(
					$elm$json$Json$Encode$object(
						_List_fromArray(
							[
								_Utils_Tuple2(
								'to',
								$elm$json$Json$Encode$string(to)),
								_Utils_Tuple2(
								'encryptedBlob',
								$elm$json$Json$Encode$string(encryptedBlob)),
								_Utils_Tuple2(
								'timestamp',
								$elm$json$Json$Encode$int(timestamp))
							]))),
				expect: A2($lynxjs_elm$http$Http$expectJson, $author$project$Main$GotSendResult, $author$project$Main$sendDecoder),
				headers: _List_fromArray(
					[
						A2($lynxjs_elm$http$Http$header, 'Authorization', 'Bearer ' + token)
					]),
				method: 'POST',
				timeout: $elm$core$Maybe$Just(10000),
				tracker: $elm$core$Maybe$Nothing,
				url: serverUrl + '/messages/'
			});
	});
var $elm$core$String$trim = _String_trim;
var $author$project$Main$GotVerify = function (a) {
	return {$: 'GotVerify', a: a};
};
var $author$project$Main$VerifyResponse = F2(
	function (token, expiresAt) {
		return {expiresAt: expiresAt, token: token};
	});
var $author$project$Main$verifyDecoder = A3(
	$elm$json$Json$Decode$map2,
	$author$project$Main$VerifyResponse,
	A2($elm$json$Json$Decode$field, 'token', $elm$json$Json$Decode$string),
	A2($elm$json$Json$Decode$field, 'expiresAt', $elm$json$Json$Decode$int));
var $author$project$Main$verifyAuth = F4(
	function (serverUrl, pubkey, challenge, signature) {
		return $lynxjs_elm$http$Http$post(
			{
				body: $lynxjs_elm$http$Http$jsonBody(
					$elm$json$Json$Encode$object(
						_List_fromArray(
							[
								_Utils_Tuple2(
								'pubkey',
								$elm$json$Json$Encode$string(pubkey)),
								_Utils_Tuple2(
								'challenge',
								$elm$json$Json$Encode$string(challenge)),
								_Utils_Tuple2(
								'signature',
								$elm$json$Json$Encode$string(signature))
							]))),
				expect: A2($lynxjs_elm$http$Http$expectJson, $author$project$Main$GotVerify, $author$project$Main$verifyDecoder),
				url: serverUrl + '/auth/verify'
			});
	});
var $author$project$Main$update = F2(
	function (msg, model) {
		switch (msg.$) {
			case 'GotSeed':
				var seedHex = msg.a;
				var xPriv = $lynxjs_elm$crypto$Crypto$X25519$privateKeyFromHex(seedHex);
				var edPriv = $lynxjs_elm$crypto$Crypto$Ed25519$privateKeyFromHex(seedHex);
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{
							edPriv: edPriv,
							edPub: A2($elm$core$Maybe$map, $lynxjs_elm$crypto$Crypto$Ed25519$getPublicKey, edPriv),
							xPriv: xPriv,
							xPub: A2($elm$core$Maybe$map, $lynxjs_elm$crypto$Crypto$X25519$getPublicKey, xPriv)
						}),
					$elm$core$Platform$Cmd$none);
			case 'GotTime':
				var posix = msg.a;
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{
							currentTime: ($elm$time$Time$posixToMillis(posix) / 1000) | 0
						}),
					$elm$core$Platform$Cmd$none);
			case 'Connect':
				var _v1 = model.edPub;
				if (_v1.$ === 'Just') {
					var pub = _v1.a;
					return _Utils_Tuple2(
						_Utils_update(
							model,
							{connecting: true, error: $elm$core$Maybe$Nothing}),
						A2(
							$author$project$Main$requestChallenge,
							model.serverUrl,
							$lynxjs_elm$crypto$Crypto$Ed25519$publicKeyToHex(pub)));
				} else {
					return _Utils_Tuple2(
						_Utils_update(
							model,
							{
								error: $elm$core$Maybe$Just('No identity keypair')
							}),
						$elm$core$Platform$Cmd$none);
				}
			case 'GotChallenge':
				var result = msg.a;
				var _v2 = _Utils_Tuple2(result, model.edPriv);
				if (_v2.a.$ === 'Ok') {
					if (_v2.b.$ === 'Just') {
						var resp = _v2.a.a;
						var priv = _v2.b.a;
						var sig = A2($lynxjs_elm$crypto$Crypto$Ed25519$sign, resp.challenge, priv);
						return _Utils_Tuple2(
							model,
							A4(
								$author$project$Main$verifyAuth,
								model.serverUrl,
								A2(
									$elm$core$Maybe$withDefault,
									'',
									A2($elm$core$Maybe$map, $lynxjs_elm$crypto$Crypto$Ed25519$publicKeyToHex, model.edPub)),
								resp.challenge,
								$lynxjs_elm$crypto$Crypto$Ed25519$signatureToHex(sig)));
					} else {
						return _Utils_Tuple2(
							_Utils_update(
								model,
								{connecting: false}),
							$elm$core$Platform$Cmd$none);
					}
				} else {
					var err = _v2.a.a;
					return _Utils_Tuple2(
						_Utils_update(
							model,
							{
								connecting: false,
								error: $elm$core$Maybe$Just(
									$author$project$Main$httpErrorToString(err))
							}),
						$elm$core$Platform$Cmd$none);
				}
			case 'GotVerify':
				var result = msg.a;
				if (result.$ === 'Ok') {
					var resp = result.a;
					return (resp.token !== '') ? _Utils_Tuple2(
						_Utils_update(
							model,
							{authToken: resp.token, connecting: false, screen: $author$project$Main$ContactsScreen}),
						$elm$core$Platform$Cmd$none) : _Utils_Tuple2(
						_Utils_update(
							model,
							{
								connecting: false,
								error: $elm$core$Maybe$Just('Authentication failed')
							}),
						$elm$core$Platform$Cmd$none);
				} else {
					var err = result.a;
					return _Utils_Tuple2(
						_Utils_update(
							model,
							{
								connecting: false,
								error: $elm$core$Maybe$Just(
									$author$project$Main$httpErrorToString(err))
							}),
						$elm$core$Platform$Cmd$none);
				}
			case 'PrepareSend':
				return $elm$core$String$isEmpty(
					$elm$core$String$trim(model.draft)) ? _Utils_Tuple2(model, $elm$core$Platform$Cmd$none) : _Utils_Tuple2(
					_Utils_update(
						model,
						{sending: true}),
					A2(
						$elm$random$Random$generate,
						$author$project$Main$GotSendEntropy,
						$author$project$Main$randomHexString(72)));
			case 'GotSendEntropy':
				var entropyHex = msg.a;
				var _v4 = _Utils_Tuple2(model.edPriv, model.edPub);
				if ((_v4.a.$ === 'Just') && (_v4.b.$ === 'Just')) {
					var edPriv = _v4.a.a;
					var edPub = _v4.b.a;
					var recipientEdHex = model.activeChat;
					var contact = A2($elm$core$Dict$get, recipientEdHex, model.contacts);
					if (contact.$ === 'Just') {
						var c = contact.a;
						var timestamp = model.currentTime;
						var nonceHex = A3($elm$core$String$slice, 96, 144, entropyHex);
						var msgId = A2($elm$core$String$left, 32, entropyHex);
						var outMsg = {body: model.draft, id: msgId, outgoing: true, timestamp: timestamp};
						var plaintextJson = A2(
							$elm$json$Json$Encode$encode,
							0,
							$elm$json$Json$Encode$object(
								_List_fromArray(
									[
										_Utils_Tuple2(
										'type',
										$elm$json$Json$Encode$string('text')),
										_Utils_Tuple2(
										'id',
										$elm$json$Json$Encode$string(msgId)),
										_Utils_Tuple2(
										'timestamp',
										$elm$json$Json$Encode$int(timestamp)),
										_Utils_Tuple2(
										'body',
										$elm$json$Json$Encode$string(model.draft))
									])));
						var existing = A2(
							$elm$core$Maybe$withDefault,
							_List_Nil,
							A2($elm$core$Dict$get, recipientEdHex, model.messages));
						var ephSeedHex = A3($elm$core$String$slice, 32, 96, entropyHex);
						var blob = A6($author$project$Main$encryptMessage, edPriv, edPub, c.xPubHex, ephSeedHex, nonceHex, plaintextJson);
						if (blob.$ === 'Just') {
							var blobHex = blob.a;
							return _Utils_Tuple2(
								_Utils_update(
									model,
									{
										draft: '',
										messages: A3(
											$elm$core$Dict$insert,
											recipientEdHex,
											_Utils_ap(
												existing,
												_List_fromArray(
													[outMsg])),
											model.messages)
									}),
								A5($author$project$Main$sendMessageHttp, model.serverUrl, model.authToken, recipientEdHex, blobHex, timestamp));
						} else {
							return _Utils_Tuple2(
								_Utils_update(
									model,
									{
										error: $elm$core$Maybe$Just('Encryption failed'),
										sending: false
									}),
								$elm$core$Platform$Cmd$none);
						}
					} else {
						return _Utils_Tuple2(
							_Utils_update(
								model,
								{
									error: $elm$core$Maybe$Just('Contact not found'),
									sending: false
								}),
							$elm$core$Platform$Cmd$none);
					}
				} else {
					return _Utils_Tuple2(
						_Utils_update(
							model,
							{
								error: $elm$core$Maybe$Just('No identity'),
								sending: false
							}),
						$elm$core$Platform$Cmd$none);
				}
			case 'GotSendResult':
				var result = msg.a;
				if (result.$ === 'Ok') {
					return _Utils_Tuple2(
						_Utils_update(
							model,
							{sending: false}),
						$elm$core$Platform$Cmd$none);
				} else {
					var err = result.a;
					return _Utils_Tuple2(
						_Utils_update(
							model,
							{
								error: $elm$core$Maybe$Just(
									$author$project$Main$httpErrorToString(err)),
								sending: false
							}),
						$elm$core$Platform$Cmd$none);
				}
			case 'PollTick':
				var posix = msg.a;
				var t = ($elm$time$Time$posixToMillis(posix) / 1000) | 0;
				return (model.authToken !== '') ? _Utils_Tuple2(
					_Utils_update(
						model,
						{currentTime: t}),
					A2($author$project$Main$pollMessages, model.serverUrl, model.authToken)) : _Utils_Tuple2(
					_Utils_update(
						model,
						{currentTime: t}),
					$elm$core$Platform$Cmd$none);
			case 'GotPoll':
				var result = msg.a;
				var _v8 = _Utils_Tuple3(result, model.xPriv, model.edPub);
				_v8$2:
				while (true) {
					if (_v8.a.$ === 'Ok') {
						if ((_v8.b.$ === 'Just') && (_v8.c.$ === 'Just')) {
							var resp = _v8.a.a;
							var xPriv = _v8.b.a;
							var edPub = _v8.c.a;
							var myEdHex = $lynxjs_elm$crypto$Crypto$Ed25519$publicKeyToHex(edPub);
							var _v9 = A4($author$project$Main$processEvents, xPriv, myEdHex, resp.events, model.seenIds);
							var newMessages = _v9.a;
							var newSeenIds = _v9.b;
							var ackIds = _v9.c;
							var ackCmd = $elm$core$List$isEmpty(ackIds) ? $elm$core$Platform$Cmd$none : A3($author$project$Main$ackMessages, model.serverUrl, model.authToken, ackIds);
							var updatedContacts = A3(
								$elm$core$List$foldl,
								F2(
									function (_v11, dict) {
										var from = _v11.a;
										var chatMsg = _v11.b;
										return A3(
											$elm$core$Dict$update,
											from,
											function (existing) {
												if (existing.$ === 'Just') {
													var c = existing.a;
													return $elm$core$Maybe$Just(
														_Utils_update(
															c,
															{lastMessage: chatMsg.body, lastTime: chatMsg.timestamp}));
												} else {
													return $elm$core$Maybe$Just(
														{
															edPubHex: from,
															lastMessage: chatMsg.body,
															lastTime: chatMsg.timestamp,
															name: A2($elm$core$String$left, 8, from) + '...',
															online: true,
															xPubHex: ''
														});
												}
											},
											dict);
									}),
								model.contacts,
								newMessages);
							var updatedMessages = A3(
								$elm$core$List$foldl,
								F2(
									function (_v10, dict) {
										var from = _v10.a;
										var chatMsg = _v10.b;
										var existing = A2(
											$elm$core$Maybe$withDefault,
											_List_Nil,
											A2($elm$core$Dict$get, from, dict));
										return A3(
											$elm$core$Dict$insert,
											from,
											_Utils_ap(
												existing,
												_List_fromArray(
													[chatMsg])),
											dict);
									}),
								model.messages,
								newMessages);
							return _Utils_Tuple2(
								_Utils_update(
									model,
									{contacts: updatedContacts, messages: updatedMessages, seenIds: newSeenIds}),
								ackCmd);
						} else {
							break _v8$2;
						}
					} else {
						if ((_v8.a.a.$ === 'BadStatus') && (_v8.a.a.a === 401)) {
							return _Utils_Tuple2(
								_Utils_update(
									model,
									{
										authToken: '',
										error: $elm$core$Maybe$Just('Session expired, please reconnect'),
										screen: $author$project$Main$SetupScreen
									}),
								$elm$core$Platform$Cmd$none);
						} else {
							break _v8$2;
						}
					}
				}
				return _Utils_Tuple2(model, $elm$core$Platform$Cmd$none);
			case 'GotAck':
				return _Utils_Tuple2(model, $elm$core$Platform$Cmd$none);
			case 'AddContact':
				if ($elm$core$String$isEmpty(model.addIdentity)) {
					return _Utils_Tuple2(model, $elm$core$Platform$Cmd$none);
				} else {
					var _v13 = $author$project$Main$parseIdentity(model.addIdentity);
					if (_v13.$ === 'Just') {
						var _v14 = _v13.a;
						var edHex = _v14.a;
						var xHex = _v14.b;
						var name = $elm$core$String$isEmpty(model.addName) ? (A2($elm$core$String$left, 8, edHex) + '...') : model.addName;
						var contact = {edPubHex: edHex, lastMessage: '', lastTime: 0, name: name, online: false, xPubHex: xHex};
						return _Utils_Tuple2(
							_Utils_update(
								model,
								{
									addIdentity: '',
									addName: '',
									contacts: A3($elm$core$Dict$insert, edHex, contact, model.contacts),
									screen: $author$project$Main$ContactsScreen
								}),
							A2($author$project$Main$lookupPresence, model.serverUrl, edHex));
					} else {
						return _Utils_Tuple2(
							_Utils_update(
								model,
								{
									error: $elm$core$Maybe$Just('Invalid identity. Expected: <ed25519_hex>.<x25519_hex>')
								}),
							$elm$core$Platform$Cmd$none);
					}
				}
			case 'GotLookup':
				var result = msg.a;
				if (result.$ === 'Ok') {
					var resp = result.a;
					return _Utils_Tuple2(
						_Utils_update(
							model,
							{
								contacts: A3(
									$elm$core$Dict$update,
									resp.pubkey,
									$elm$core$Maybe$map(
										function (c) {
											return _Utils_update(
												c,
												{online: resp.online});
										}),
									model.contacts)
							}),
						$elm$core$Platform$Cmd$none);
				} else {
					return _Utils_Tuple2(model, $elm$core$Platform$Cmd$none);
				}
			case 'Navigate':
				var screen = msg.a;
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{screen: screen}),
					$elm$core$Platform$Cmd$none);
			case 'OpenChat':
				var edPubHex = msg.a;
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{activeChat: edPubHex, draft: '', screen: $author$project$Main$ChatScreen}),
					$elm$core$Platform$Cmd$none);
			case 'UpdateDraft':
				var text = msg.a;
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{draft: text}),
					$elm$core$Platform$Cmd$none);
			case 'UpdateServerUrl':
				var text = msg.a;
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{serverUrl: text}),
					$elm$core$Platform$Cmd$none);
			case 'UpdateAddIdentity':
				var text = msg.a;
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{addIdentity: text}),
					$elm$core$Platform$Cmd$none);
			case 'UpdateAddName':
				var text = msg.a;
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{addName: text}),
					$elm$core$Platform$Cmd$none);
			case 'UpdateDisplayName':
				var text = msg.a;
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{displayName: text}),
					$elm$core$Platform$Cmd$none);
			default:
				return _Utils_Tuple2(
					_Utils_update(
						model,
						{error: $elm$core$Maybe$Nothing}),
					$elm$core$Platform$Cmd$none);
		}
	});
var $lynxjs_elm$ui$Lynx$Attributes$Column = {$: 'Column'};
var $lynxjs_elm$virtual_dom$VirtualDom$style = _VirtualDom_style;
var $lynxjs_elm$ui$Lynx$Attributes$style = $lynxjs_elm$virtual_dom$VirtualDom$style;
var $lynxjs_elm$ui$Lynx$Attributes$backgroundColor = $lynxjs_elm$ui$Lynx$Attributes$style('backgroundColor');
var $lynxjs_elm$ui$Lynx$Attributes$Center = {$: 'Center'};
var $author$project$Main$DismissError = {$: 'DismissError'};
var $lynxjs_elm$ui$Lynx$Attributes$Row = {$: 'Row'};
var $lynxjs_elm$ui$Lynx$Attributes$alignmentToString = function (a) {
	switch (a.$) {
		case 'Start':
			return 'flex-start';
		case 'Center':
			return 'center';
		case 'End':
			return 'flex-end';
		case 'SpaceBetween':
			return 'space-between';
		case 'SpaceAround':
			return 'space-around';
		case 'SpaceEvenly':
			return 'space-evenly';
		case 'Stretch':
			return 'stretch';
		default:
			return 'baseline';
	}
};
var $lynxjs_elm$ui$Lynx$Attributes$alignItems = function (a) {
	return A2(
		$lynxjs_elm$ui$Lynx$Attributes$style,
		'alignItems',
		$lynxjs_elm$ui$Lynx$Attributes$alignmentToString(a));
};
var $lynxjs_elm$ui$Lynx$Attributes$color = $lynxjs_elm$ui$Lynx$Attributes$style('color');
var $lynxjs_elm$ui$Lynx$Attributes$intStyle = F2(
	function (key, val) {
		return A2(
			$lynxjs_elm$virtual_dom$VirtualDom$style,
			key,
			$elm$core$String$fromInt(val));
	});
var $lynxjs_elm$ui$Lynx$Attributes$flex = $lynxjs_elm$ui$Lynx$Attributes$intStyle('flex');
var $lynxjs_elm$ui$Lynx$Attributes$flexDirection = function (d) {
	return A2(
		$lynxjs_elm$ui$Lynx$Attributes$style,
		'flexDirection',
		function () {
			switch (d.$) {
				case 'Row':
					return 'row';
				case 'Column':
					return 'column';
				case 'RowReverse':
					return 'row-reverse';
				default:
					return 'column-reverse';
			}
		}());
};
var $lynxjs_elm$ui$Lynx$Attributes$pxStyle = F2(
	function (key, val) {
		return A2(
			$lynxjs_elm$virtual_dom$VirtualDom$style,
			key,
			$elm$core$String$fromInt(val) + 'px');
	});
var $lynxjs_elm$ui$Lynx$Attributes$fontSize = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('fontSize');
var $lynxjs_elm$virtual_dom$VirtualDom$Normal = function (a) {
	return {$: 'Normal', a: a};
};
var $lynxjs_elm$virtual_dom$VirtualDom$on = _VirtualDom_on;
var $lynxjs_elm$ui$Lynx$Events$onTap = function (msg) {
	return A2(
		$lynxjs_elm$virtual_dom$VirtualDom$on,
		'tap',
		$lynxjs_elm$virtual_dom$VirtualDom$Normal(
			$elm$json$Json$Decode$succeed(msg)));
};
var $lynxjs_elm$ui$Lynx$Attributes$paddingBottom = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('paddingBottom');
var $lynxjs_elm$ui$Lynx$Attributes$paddingLeft = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('paddingLeft');
var $lynxjs_elm$ui$Lynx$Attributes$paddingRight = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('paddingRight');
var $lynxjs_elm$ui$Lynx$Attributes$paddingTop = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('paddingTop');
var $lynxjs_elm$virtual_dom$VirtualDom$node = function (tag) {
	return _VirtualDom_node(
		_VirtualDom_noScript(tag));
};
var $lynxjs_elm$ui$Lynx$text = $lynxjs_elm$virtual_dom$VirtualDom$node('text');
var $lynxjs_elm$virtual_dom$VirtualDom$text = _VirtualDom_text;
var $lynxjs_elm$ui$Lynx$textContent = $lynxjs_elm$virtual_dom$VirtualDom$text;
var $lynxjs_elm$ui$Lynx$view = $lynxjs_elm$virtual_dom$VirtualDom$node('view');
var $author$project$Main$errorBanner = function (err) {
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Events$onTap($author$project$Main$DismissError),
				$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#3d1114'),
				$lynxjs_elm$ui$Lynx$Attributes$paddingTop(10),
				$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(10),
				$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(16),
				$lynxjs_elm$ui$Lynx$Attributes$paddingRight(16),
				$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
				$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center)
			]),
		_List_fromArray(
			[
				A2(
				$lynxjs_elm$ui$Lynx$text,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$color('#f85149'),
						$lynxjs_elm$ui$Lynx$Attributes$fontSize(14),
						$lynxjs_elm$ui$Lynx$Attributes$flex(1)
					]),
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$textContent(err)
					])),
				A2(
				$lynxjs_elm$ui$Lynx$text,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$color('#f85149'),
						$lynxjs_elm$ui$Lynx$Attributes$fontSize(16)
					]),
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$textContent('x')
					]))
			]));
};
var $author$project$Main$AddContact = {$: 'AddContact'};
var $lynxjs_elm$ui$Lynx$Attributes$Bold = {$: 'Bold'};
var $author$project$Main$Navigate = function (a) {
	return {$: 'Navigate', a: a};
};
var $author$project$Main$UpdateAddIdentity = function (a) {
	return {$: 'UpdateAddIdentity', a: a};
};
var $author$project$Main$UpdateAddName = function (a) {
	return {$: 'UpdateAddName', a: a};
};
var $lynxjs_elm$ui$Lynx$Attributes$marginBottom = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('marginBottom');
var $author$project$Main$fieldLabel = function (text) {
	return A2(
		$lynxjs_elm$ui$Lynx$text,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
				$lynxjs_elm$ui$Lynx$Attributes$fontSize(13),
				$lynxjs_elm$ui$Lynx$Attributes$marginBottom(6)
			]),
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$textContent(text)
			]));
};
var $lynxjs_elm$ui$Lynx$Attributes$fontWeight = function (w) {
	return A2(
		$lynxjs_elm$ui$Lynx$Attributes$style,
		'fontWeight',
		function () {
			if (w.$ === 'Normal') {
				return 'normal';
			} else {
				return 'bold';
			}
		}());
};
var $lynxjs_elm$ui$Lynx$Attributes$padding = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('padding');
var $lynxjs_elm$ui$Lynx$Attributes$borderRadius = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('borderRadius');
var $author$project$Main$primaryButton = F2(
	function (msg, text) {
		return A2(
			$lynxjs_elm$ui$Lynx$view,
			_List_fromArray(
				[
					$lynxjs_elm$ui$Lynx$Events$onTap(msg),
					$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#58a6ff'),
					$lynxjs_elm$ui$Lynx$Attributes$borderRadius(8),
					$lynxjs_elm$ui$Lynx$Attributes$paddingTop(14),
					$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(14),
					$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center)
				]),
			_List_fromArray(
				[
					A2(
					$lynxjs_elm$ui$Lynx$text,
					_List_fromArray(
						[
							$lynxjs_elm$ui$Lynx$Attributes$color('#ffffff'),
							$lynxjs_elm$ui$Lynx$Attributes$fontSize(16),
							$lynxjs_elm$ui$Lynx$Attributes$fontWeight($lynxjs_elm$ui$Lynx$Attributes$Bold)
						]),
					_List_fromArray(
						[
							$lynxjs_elm$ui$Lynx$textContent(text)
						]))
				]));
	});
var $lynxjs_elm$ui$Lynx$Attributes$height = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('height');
var $author$project$Main$spacer = function (px) {
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$height(px)
			]),
		_List_Nil);
};
var $lynxjs_elm$ui$Lynx$Attributes$borderColor = $lynxjs_elm$ui$Lynx$Attributes$style('borderColor');
var $lynxjs_elm$ui$Lynx$Attributes$borderWidth = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('borderWidth');
var $lynxjs_elm$ui$Lynx$input = $lynxjs_elm$virtual_dom$VirtualDom$node('input');
var $elm$json$Json$Decode$at = F2(
	function (fields, decoder) {
		return A3($elm$core$List$foldr, $elm$json$Json$Decode$field, decoder, fields);
	});
var $lynxjs_elm$ui$Lynx$Events$onInput = function (tagger) {
	return A2(
		$lynxjs_elm$virtual_dom$VirtualDom$on,
		'input',
		$lynxjs_elm$virtual_dom$VirtualDom$Normal(
			A2(
				$elm$json$Json$Decode$map,
				tagger,
				A2(
					$elm$json$Json$Decode$at,
					_List_fromArray(
						['detail', 'value']),
					$elm$json$Json$Decode$string))));
};
var $lynxjs_elm$virtual_dom$VirtualDom$attribute = F2(
	function (key, value) {
		return A2(
			_VirtualDom_attribute,
			_VirtualDom_noOnOrFormAction(key),
			_VirtualDom_noJavaScriptOrHtmlUri(value));
	});
var $lynxjs_elm$ui$Lynx$Attributes$attr = $lynxjs_elm$virtual_dom$VirtualDom$attribute;
var $lynxjs_elm$ui$Lynx$Attributes$placeholder = $lynxjs_elm$ui$Lynx$Attributes$attr('placeholder');
var $lynxjs_elm$ui$Lynx$Attributes$value = $lynxjs_elm$ui$Lynx$Attributes$attr('value');
var $author$project$Main$textInput = function (config) {
	return A2(
		$lynxjs_elm$ui$Lynx$input,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Events$onInput(config.onInput),
				$lynxjs_elm$ui$Lynx$Attributes$value(config.value),
				$lynxjs_elm$ui$Lynx$Attributes$placeholder(config.placeholder),
				$lynxjs_elm$ui$Lynx$Attributes$height(44),
				$lynxjs_elm$ui$Lynx$Attributes$fontSize(16),
				$lynxjs_elm$ui$Lynx$Attributes$color('#c9d1d9'),
				$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#161b22'),
				$lynxjs_elm$ui$Lynx$Attributes$borderWidth(1),
				$lynxjs_elm$ui$Lynx$Attributes$borderColor('#30363d'),
				$lynxjs_elm$ui$Lynx$Attributes$borderRadius(8),
				$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(12)
			]),
		_List_Nil);
};
var $author$project$Main$viewAddContact = function (model) {
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Column),
				$lynxjs_elm$ui$Lynx$Attributes$flex(1)
			]),
		_List_fromArray(
			[
				A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
						$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
						$lynxjs_elm$ui$Lynx$Attributes$paddingTop(12),
						$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(12),
						$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(16),
						$lynxjs_elm$ui$Lynx$Attributes$paddingRight(16),
						$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#161b22')
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$view,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Events$onTap(
								$author$project$Main$Navigate($author$project$Main$ContactsScreen)),
								$lynxjs_elm$ui$Lynx$Attributes$paddingRight(12),
								$lynxjs_elm$ui$Lynx$Attributes$paddingTop(4),
								$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(4)
							]),
						_List_fromArray(
							[
								A2(
								$lynxjs_elm$ui$Lynx$text,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$color('#58a6ff'),
										$lynxjs_elm$ui$Lynx$Attributes$fontSize(20)
									]),
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$textContent('<')
									]))
							])),
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#c9d1d9'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(18),
								$lynxjs_elm$ui$Lynx$Attributes$fontWeight($lynxjs_elm$ui$Lynx$Attributes$Bold)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent('Add Contact')
							]))
					])),
				A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$padding(24),
						$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Column)
					]),
				_List_fromArray(
					[
						$author$project$Main$fieldLabel('Identity string'),
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#6e7681'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(12),
								$lynxjs_elm$ui$Lynx$Attributes$marginBottom(8)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent('Paste the <ed25519>.<x25519> identity from your contact')
							])),
						$author$project$Main$textInput(
						{onInput: $author$project$Main$UpdateAddIdentity, placeholder: 'abc123...def456.ghi789...jkl012', value: model.addIdentity}),
						$author$project$Main$spacer(20),
						$author$project$Main$fieldLabel('Name'),
						$author$project$Main$textInput(
						{onInput: $author$project$Main$UpdateAddName, placeholder: 'Display name (optional)', value: model.addName}),
						$author$project$Main$spacer(32),
						A2($author$project$Main$primaryButton, $author$project$Main$AddContact, 'Add Contact')
					]))
			]));
};
var $author$project$Main$PrepareSend = {$: 'PrepareSend'};
var $lynxjs_elm$ui$Lynx$Attributes$TextCenter = {$: 'TextCenter'};
var $author$project$Main$UpdateDraft = function (a) {
	return {$: 'UpdateDraft', a: a};
};
var $lynxjs_elm$ui$Lynx$Attributes$Vertical = {$: 'Vertical'};
var $lynxjs_elm$ui$Lynx$Attributes$justifyContent = function (a) {
	return A2(
		$lynxjs_elm$ui$Lynx$Attributes$style,
		'justifyContent',
		$lynxjs_elm$ui$Lynx$Attributes$alignmentToString(a));
};
var $lynxjs_elm$ui$Lynx$Attributes$marginLeft = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('marginLeft');
var $lynxjs_elm$ui$Lynx$Attributes$scrollDirection = function (d) {
	return A2(
		$lynxjs_elm$ui$Lynx$Attributes$attr,
		'scroll-direction',
		function () {
			if (d.$ === 'Vertical') {
				return 'vertical';
			} else {
				return 'horizontal';
			}
		}());
};
var $lynxjs_elm$ui$Lynx$scrollView = $lynxjs_elm$virtual_dom$VirtualDom$node('scroll-view');
var $lynxjs_elm$ui$Lynx$Attributes$textAlign = function (a) {
	return A2(
		$lynxjs_elm$ui$Lynx$Attributes$style,
		'textAlign',
		function () {
			switch (a.$) {
				case 'Left':
					return 'left';
				case 'Right':
					return 'right';
				case 'TextCenter':
					return 'center';
				default:
					return 'justify';
			}
		}());
};
var $elm$core$String$right = F2(
	function (n, string) {
		return (n < 1) ? '' : A3(
			$elm$core$String$slice,
			-n,
			$elm$core$String$length(string),
			string);
	});
var $author$project$Main$truncateKey = function (key) {
	return ($elm$core$String$length(key) > 16) ? (A2($elm$core$String$left, 8, key) + ('...' + A2($elm$core$String$right, 8, key))) : key;
};
var $lynxjs_elm$ui$Lynx$Attributes$End = {$: 'End'};
var $lynxjs_elm$ui$Lynx$Attributes$Start = {$: 'Start'};
var $lynxjs_elm$ui$Lynx$Attributes$maxWidth = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('maxWidth');
var $author$project$Main$viewMessage = function (chatMsg) {
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
				$lynxjs_elm$ui$Lynx$Attributes$justifyContent(
				chatMsg.outgoing ? $lynxjs_elm$ui$Lynx$Attributes$End : $lynxjs_elm$ui$Lynx$Attributes$Start),
				$lynxjs_elm$ui$Lynx$Attributes$marginBottom(6)
			]),
		_List_fromArray(
			[
				A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$backgroundColor(
						chatMsg.outgoing ? '#1a3a5c' : '#21262d'),
						$lynxjs_elm$ui$Lynx$Attributes$borderRadius(16),
						$lynxjs_elm$ui$Lynx$Attributes$paddingTop(10),
						$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(10),
						$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(14),
						$lynxjs_elm$ui$Lynx$Attributes$paddingRight(14),
						$lynxjs_elm$ui$Lynx$Attributes$maxWidth(280)
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#c9d1d9'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(15)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent(chatMsg.body)
							]))
					]))
			]));
};
var $lynxjs_elm$ui$Lynx$Attributes$width = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('width');
var $author$project$Main$viewChat = function (model) {
	var contactName = A2(
		$elm$core$Maybe$withDefault,
		$author$project$Main$truncateKey(model.activeChat),
		A2(
			$elm$core$Maybe$map,
			function ($) {
				return $.name;
			},
			A2($elm$core$Dict$get, model.activeChat, model.contacts)));
	var chatMessages = A2(
		$elm$core$Maybe$withDefault,
		_List_Nil,
		A2($elm$core$Dict$get, model.activeChat, model.messages));
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Column),
				$lynxjs_elm$ui$Lynx$Attributes$flex(1)
			]),
		_List_fromArray(
			[
				A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
						$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
						$lynxjs_elm$ui$Lynx$Attributes$paddingTop(12),
						$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(12),
						$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(16),
						$lynxjs_elm$ui$Lynx$Attributes$paddingRight(16),
						$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#161b22')
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$view,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Events$onTap(
								$author$project$Main$Navigate($author$project$Main$ContactsScreen)),
								$lynxjs_elm$ui$Lynx$Attributes$paddingRight(12),
								$lynxjs_elm$ui$Lynx$Attributes$paddingTop(4),
								$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(4)
							]),
						_List_fromArray(
							[
								A2(
								$lynxjs_elm$ui$Lynx$text,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$color('#58a6ff'),
										$lynxjs_elm$ui$Lynx$Attributes$fontSize(20)
									]),
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$textContent('<')
									]))
							])),
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#c9d1d9'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(18),
								$lynxjs_elm$ui$Lynx$Attributes$fontWeight($lynxjs_elm$ui$Lynx$Attributes$Bold),
								$lynxjs_elm$ui$Lynx$Attributes$flex(1)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent(contactName)
							]))
					])),
				A2(
				$lynxjs_elm$ui$Lynx$scrollView,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$flex(1),
						$lynxjs_elm$ui$Lynx$Attributes$scrollDirection($lynxjs_elm$ui$Lynx$Attributes$Vertical),
						$lynxjs_elm$ui$Lynx$Attributes$paddingTop(12),
						$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(12),
						$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(16),
						$lynxjs_elm$ui$Lynx$Attributes$paddingRight(16)
					]),
				$elm$core$List$isEmpty(chatMessages) ? _List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$view,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
								$lynxjs_elm$ui$Lynx$Attributes$paddingTop(80)
							]),
						_List_fromArray(
							[
								A2(
								$lynxjs_elm$ui$Lynx$text,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
										$lynxjs_elm$ui$Lynx$Attributes$fontSize(14),
										$lynxjs_elm$ui$Lynx$Attributes$textAlign($lynxjs_elm$ui$Lynx$Attributes$TextCenter)
									]),
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$textContent('No messages yet. Say hello!')
									]))
							]))
					]) : A2($elm$core$List$map, $author$project$Main$viewMessage, chatMessages)),
				A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
						$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
						$lynxjs_elm$ui$Lynx$Attributes$paddingTop(8),
						$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(8),
						$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(12),
						$lynxjs_elm$ui$Lynx$Attributes$paddingRight(12),
						$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#161b22')
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$input,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Events$onInput($author$project$Main$UpdateDraft),
								$lynxjs_elm$ui$Lynx$Attributes$value(model.draft),
								$lynxjs_elm$ui$Lynx$Attributes$placeholder('Message...'),
								$lynxjs_elm$ui$Lynx$Attributes$flex(1),
								$lynxjs_elm$ui$Lynx$Attributes$height(40),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(16),
								$lynxjs_elm$ui$Lynx$Attributes$color('#c9d1d9'),
								$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#0d1117'),
								$lynxjs_elm$ui$Lynx$Attributes$borderWidth(1),
								$lynxjs_elm$ui$Lynx$Attributes$borderColor('#30363d'),
								$lynxjs_elm$ui$Lynx$Attributes$borderRadius(20),
								$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(16)
							]),
						_List_Nil),
						A2(
						$lynxjs_elm$ui$Lynx$view,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Events$onTap($author$project$Main$PrepareSend),
								$lynxjs_elm$ui$Lynx$Attributes$marginLeft(8),
								$lynxjs_elm$ui$Lynx$Attributes$backgroundColor(
								(model.sending || $elm$core$String$isEmpty(
									$elm$core$String$trim(model.draft))) ? '#30363d' : '#58a6ff'),
								$lynxjs_elm$ui$Lynx$Attributes$borderRadius(20),
								$lynxjs_elm$ui$Lynx$Attributes$width(40),
								$lynxjs_elm$ui$Lynx$Attributes$height(40),
								$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
								$lynxjs_elm$ui$Lynx$Attributes$justifyContent($lynxjs_elm$ui$Lynx$Attributes$Center)
							]),
						_List_fromArray(
							[
								A2(
								$lynxjs_elm$ui$Lynx$text,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$color('#ffffff'),
										$lynxjs_elm$ui$Lynx$Attributes$fontSize(16),
										$lynxjs_elm$ui$Lynx$Attributes$fontWeight($lynxjs_elm$ui$Lynx$Attributes$Bold)
									]),
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$textContent('^')
									]))
							]))
					]))
			]));
};
var $author$project$Main$AddContactScreen = {$: 'AddContactScreen'};
var $elm$core$Dict$isEmpty = function (dict) {
	if (dict.$ === 'RBEmpty_elm_builtin') {
		return true;
	} else {
		return false;
	}
};
var $lynxjs_elm$ui$Lynx$Attributes$marginRight = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('marginRight');
var $elm$core$List$sortBy = _List_sortBy;
var $elm$core$Dict$values = function (dict) {
	return A3(
		$elm$core$Dict$foldr,
		F3(
			function (key, value, valueList) {
				return A2($elm$core$List$cons, value, valueList);
			}),
		_List_Nil,
		dict);
};
var $author$project$Main$OpenChat = function (a) {
	return {$: 'OpenChat', a: a};
};
var $lynxjs_elm$ui$Lynx$Attributes$marginTop = $lynxjs_elm$ui$Lynx$Attributes$pxStyle('marginTop');
var $elm$core$String$toUpper = _String_toUpper;
var $author$project$Main$viewContactRow = function (contact) {
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Events$onTap(
				$author$project$Main$OpenChat(contact.edPubHex)),
				$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
				$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
				$lynxjs_elm$ui$Lynx$Attributes$paddingTop(14),
				$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(14),
				$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(20),
				$lynxjs_elm$ui$Lynx$Attributes$paddingRight(20),
				$lynxjs_elm$ui$Lynx$Attributes$borderColor('#21262d'),
				$lynxjs_elm$ui$Lynx$Attributes$borderWidth(1)
			]),
		_List_fromArray(
			[
				A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$width(44),
						$lynxjs_elm$ui$Lynx$Attributes$height(44),
						$lynxjs_elm$ui$Lynx$Attributes$borderRadius(22),
						$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#30363d'),
						$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
						$lynxjs_elm$ui$Lynx$Attributes$justifyContent($lynxjs_elm$ui$Lynx$Attributes$Center),
						$lynxjs_elm$ui$Lynx$Attributes$marginRight(12)
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#58a6ff'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(18),
								$lynxjs_elm$ui$Lynx$Attributes$fontWeight($lynxjs_elm$ui$Lynx$Attributes$Bold)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent(
								$elm$core$String$toUpper(
									A2($elm$core$String$left, 1, contact.name)))
							]))
					])),
				A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$flex(1),
						$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Column)
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$view,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
								$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center)
							]),
						_List_fromArray(
							[
								A2(
								$lynxjs_elm$ui$Lynx$text,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$color('#c9d1d9'),
										$lynxjs_elm$ui$Lynx$Attributes$fontSize(16),
										$lynxjs_elm$ui$Lynx$Attributes$fontWeight($lynxjs_elm$ui$Lynx$Attributes$Bold),
										$lynxjs_elm$ui$Lynx$Attributes$flex(1)
									]),
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$textContent(contact.name)
									])),
								contact.online ? A2(
								$lynxjs_elm$ui$Lynx$view,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$width(8),
										$lynxjs_elm$ui$Lynx$Attributes$height(8),
										$lynxjs_elm$ui$Lynx$Attributes$borderRadius(4),
										$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#3fb950'),
										$lynxjs_elm$ui$Lynx$Attributes$marginLeft(8)
									]),
								_List_Nil) : A2($lynxjs_elm$ui$Lynx$view, _List_Nil, _List_Nil)
							])),
						$elm$core$String$isEmpty(contact.lastMessage) ? A2($lynxjs_elm$ui$Lynx$view, _List_Nil, _List_Nil) : A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(14),
								$lynxjs_elm$ui$Lynx$Attributes$marginTop(2)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent(
								A2($elm$core$String$left, 50, contact.lastMessage))
							]))
					]))
			]));
};
var $author$project$Main$viewContacts = function (model) {
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Column),
				$lynxjs_elm$ui$Lynx$Attributes$flex(1)
			]),
		_List_fromArray(
			[
				A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
						$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
						$lynxjs_elm$ui$Lynx$Attributes$paddingTop(16),
						$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(16),
						$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(20),
						$lynxjs_elm$ui$Lynx$Attributes$paddingRight(20),
						$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#161b22')
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(20),
								$lynxjs_elm$ui$Lynx$Attributes$fontWeight($lynxjs_elm$ui$Lynx$Attributes$Bold),
								$lynxjs_elm$ui$Lynx$Attributes$color('#c9d1d9'),
								$lynxjs_elm$ui$Lynx$Attributes$flex(1)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent('Messages')
							])),
						A2(
						$lynxjs_elm$ui$Lynx$view,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Events$onTap(
								$author$project$Main$Navigate($author$project$Main$AddContactScreen)),
								$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(12),
								$lynxjs_elm$ui$Lynx$Attributes$paddingRight(4)
							]),
						_List_fromArray(
							[
								A2(
								$lynxjs_elm$ui$Lynx$text,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$color('#58a6ff'),
										$lynxjs_elm$ui$Lynx$Attributes$fontSize(28)
									]),
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$textContent('+')
									]))
							]))
					])),
				$elm$core$Dict$isEmpty(model.contacts) ? A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$flex(1),
						$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center),
						$lynxjs_elm$ui$Lynx$Attributes$justifyContent($lynxjs_elm$ui$Lynx$Attributes$Center),
						$lynxjs_elm$ui$Lynx$Attributes$padding(40)
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(16),
								$lynxjs_elm$ui$Lynx$Attributes$textAlign($lynxjs_elm$ui$Lynx$Attributes$TextCenter)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent('No conversations yet')
							])),
						$author$project$Main$spacer(8),
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(14),
								$lynxjs_elm$ui$Lynx$Attributes$textAlign($lynxjs_elm$ui$Lynx$Attributes$TextCenter)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent('Tap + to add a contact')
							]))
					])) : A2(
				$lynxjs_elm$ui$Lynx$scrollView,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$flex(1),
						$lynxjs_elm$ui$Lynx$Attributes$scrollDirection($lynxjs_elm$ui$Lynx$Attributes$Vertical)
					]),
				A2(
					$elm$core$List$map,
					$author$project$Main$viewContactRow,
					A2(
						$elm$core$List$sortBy,
						function (c) {
							return -c.lastTime;
						},
						$elm$core$Dict$values(model.contacts)))),
				function () {
				var _v0 = model.edPub;
				if (_v0.$ === 'Just') {
					var pub = _v0.a;
					return A2(
						$lynxjs_elm$ui$Lynx$view,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$paddingTop(10),
								$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(10),
								$lynxjs_elm$ui$Lynx$Attributes$paddingLeft(20),
								$lynxjs_elm$ui$Lynx$Attributes$paddingRight(20),
								$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#161b22'),
								$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Row),
								$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center)
							]),
						_List_fromArray(
							[
								A2(
								$lynxjs_elm$ui$Lynx$view,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$width(8),
										$lynxjs_elm$ui$Lynx$Attributes$height(8),
										$lynxjs_elm$ui$Lynx$Attributes$borderRadius(4),
										$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#3fb950'),
										$lynxjs_elm$ui$Lynx$Attributes$marginRight(8)
									]),
								_List_Nil),
								A2(
								$lynxjs_elm$ui$Lynx$text,
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
										$lynxjs_elm$ui$Lynx$Attributes$fontSize(11),
										$lynxjs_elm$ui$Lynx$Attributes$flex(1)
									]),
								_List_fromArray(
									[
										$lynxjs_elm$ui$Lynx$textContent(
										$author$project$Main$truncateKey(
											$lynxjs_elm$crypto$Crypto$Ed25519$publicKeyToHex(pub)))
									]))
							]));
				} else {
					return A2($lynxjs_elm$ui$Lynx$view, _List_Nil, _List_Nil);
				}
			}()
			]));
};
var $author$project$Main$Connect = {$: 'Connect'};
var $author$project$Main$UpdateDisplayName = function (a) {
	return {$: 'UpdateDisplayName', a: a};
};
var $author$project$Main$UpdateServerUrl = function (a) {
	return {$: 'UpdateServerUrl', a: a};
};
var $author$project$Main$disabledButton = function (text) {
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#30363d'),
				$lynxjs_elm$ui$Lynx$Attributes$borderRadius(8),
				$lynxjs_elm$ui$Lynx$Attributes$paddingTop(14),
				$lynxjs_elm$ui$Lynx$Attributes$paddingBottom(14),
				$lynxjs_elm$ui$Lynx$Attributes$alignItems($lynxjs_elm$ui$Lynx$Attributes$Center)
			]),
		_List_fromArray(
			[
				A2(
				$lynxjs_elm$ui$Lynx$text,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
						$lynxjs_elm$ui$Lynx$Attributes$fontSize(16)
					]),
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$textContent(text)
					]))
			]));
};
var $author$project$Main$viewSetup = function (model) {
	var identityStr = function () {
		var _v0 = _Utils_Tuple2(model.edPub, model.xPub);
		if ((_v0.a.$ === 'Just') && (_v0.b.$ === 'Just')) {
			var edP = _v0.a.a;
			var xP = _v0.b.a;
			return $lynxjs_elm$crypto$Crypto$Ed25519$publicKeyToHex(edP) + ('.' + $lynxjs_elm$crypto$Crypto$X25519$publicKeyToHex(xP));
		} else {
			return '';
		}
	}();
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Column),
				$lynxjs_elm$ui$Lynx$Attributes$flex(1),
				$lynxjs_elm$ui$Lynx$Attributes$padding(24),
				$lynxjs_elm$ui$Lynx$Attributes$justifyContent($lynxjs_elm$ui$Lynx$Attributes$Center)
			]),
		_List_fromArray(
			[
				A2(
				$lynxjs_elm$ui$Lynx$text,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$fontSize(36),
						$lynxjs_elm$ui$Lynx$Attributes$fontWeight($lynxjs_elm$ui$Lynx$Attributes$Bold),
						$lynxjs_elm$ui$Lynx$Attributes$color('#58a6ff'),
						$lynxjs_elm$ui$Lynx$Attributes$textAlign($lynxjs_elm$ui$Lynx$Attributes$TextCenter),
						$lynxjs_elm$ui$Lynx$Attributes$marginBottom(8)
					]),
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$textContent('Skrepka')
					])),
				A2(
				$lynxjs_elm$ui$Lynx$text,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$fontSize(14),
						$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
						$lynxjs_elm$ui$Lynx$Attributes$textAlign($lynxjs_elm$ui$Lynx$Attributes$TextCenter),
						$lynxjs_elm$ui$Lynx$Attributes$marginBottom(32)
					]),
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$textContent('Encrypted messaging, no accounts')
					])),
				$author$project$Main$fieldLabel('Your identity (share this with contacts)'),
				$elm$core$String$isEmpty(identityStr) ? A2(
				$lynxjs_elm$ui$Lynx$text,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$color('#8b949e'),
						$lynxjs_elm$ui$Lynx$Attributes$fontSize(14),
						$lynxjs_elm$ui$Lynx$Attributes$marginBottom(24)
					]),
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$textContent('Generating keypair...')
					])) : A2(
				$lynxjs_elm$ui$Lynx$view,
				_List_fromArray(
					[
						$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#161b22'),
						$lynxjs_elm$ui$Lynx$Attributes$borderRadius(8),
						$lynxjs_elm$ui$Lynx$Attributes$padding(12),
						$lynxjs_elm$ui$Lynx$Attributes$marginBottom(24)
					]),
				_List_fromArray(
					[
						A2(
						$lynxjs_elm$ui$Lynx$text,
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$Attributes$color('#c9d1d9'),
								$lynxjs_elm$ui$Lynx$Attributes$fontSize(11)
							]),
						_List_fromArray(
							[
								$lynxjs_elm$ui$Lynx$textContent(identityStr)
							]))
					])),
				$author$project$Main$fieldLabel('Relay server'),
				$author$project$Main$textInput(
				{onInput: $author$project$Main$UpdateServerUrl, placeholder: 'http://relay.example.com:8080', value: model.serverUrl}),
				$author$project$Main$spacer(24),
				$author$project$Main$fieldLabel('Display name (optional)'),
				$author$project$Main$textInput(
				{onInput: $author$project$Main$UpdateDisplayName, placeholder: 'Anonymous', value: model.displayName}),
				$author$project$Main$spacer(32),
				model.connecting ? $author$project$Main$disabledButton('Connecting...') : (_Utils_eq(model.edPriv, $elm$core$Maybe$Nothing) ? $author$project$Main$disabledButton('Generating keys...') : A2($author$project$Main$primaryButton, $author$project$Main$Connect, 'Connect to Server'))
			]));
};
var $author$project$Main$view = function (model) {
	return A2(
		$lynxjs_elm$ui$Lynx$view,
		_List_fromArray(
			[
				$lynxjs_elm$ui$Lynx$Attributes$flexDirection($lynxjs_elm$ui$Lynx$Attributes$Column),
				$lynxjs_elm$ui$Lynx$Attributes$flex(1),
				$lynxjs_elm$ui$Lynx$Attributes$backgroundColor('#0d1117')
			]),
		_List_fromArray(
			[
				function () {
				var _v0 = model.error;
				if (_v0.$ === 'Just') {
					var err = _v0.a;
					return $author$project$Main$errorBanner(err);
				} else {
					return A2($lynxjs_elm$ui$Lynx$view, _List_Nil, _List_Nil);
				}
			}(),
				function () {
				var _v1 = model.screen;
				switch (_v1.$) {
					case 'SetupScreen':
						return $author$project$Main$viewSetup(model);
					case 'ContactsScreen':
						return $author$project$Main$viewContacts(model);
					case 'ChatScreen':
						return $author$project$Main$viewChat(model);
					default:
						return $author$project$Main$viewAddContact(model);
				}
			}()
			]));
};
var $author$project$Main$main = $lynxjs_elm$browser$Browser$element(
	{init: $author$project$Main$init, subscriptions: $author$project$Main$subscriptions, update: $author$project$Main$update, view: $author$project$Main$view});
_Platform_export({'Main':{'init':$author$project$Main$main(
	$elm$json$Json$Decode$succeed(_Utils_Tuple0))(0)}});}(globalThis));