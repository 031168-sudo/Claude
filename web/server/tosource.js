

//Original source code taken from to https://github.com/marcello3d/node-tosource
// toSource by Marcello Bastea-Forte - zlib license
//srgstm: Originally it was using ES5 methods Object.keys, Array.prototype.map, Array.prototype.indexOf, Array.isArray.
// I modified it to work with their underscore/lodash equivalents and made some stylistic edits:
// - `undefined` changed to void(0)
// - ';' added to statements
var toSource = function(object, filter, indent, startingIndent) {
    var KEYWORD_REGEXP = /^(abstract|boolean|break|byte|case|catch|char|class|const|continue|debugger|default|delete|do|double|else|enum|export|extends|false|final|finally|float|for|function|goto|if|implements|import|in|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|super|switch|synchronized|this|throw|throws|transient|true|try|typeof|undefined|var|void|volatile|while|with)$/;

    function legalKey(string) {
        return /^[a-z_$][0-9a-z_$]*$/gi.test(string) && !KEYWORD_REGEXP.test(string);
    }

    var seen = [];
    return walk(object, filter, indent === void(0) ? '  ' : (indent || ''), startingIndent || '', seen);

    function walk(object, filter, indent, currentIndent, seen) {
        var nextIndent = currentIndent + indent;
        object = filter ? filter(object) : object;

        switch (typeof object) {
            case 'string':
                return JSON.stringify(object);
            case 'boolean':
            case 'number':
            case 'undefined':
                return ''+object;
            case 'function':
                return object.toString();
        }

        if (object === null) return 'null';
        if (object instanceof RegExp) return object.toString();
        if (object instanceof Date) return 'new Date('+object.getTime()+')';


        var seenIndex = _.indexOf(seen, object) + 1;
        if (seenIndex > 0) return '{$circularReference:'+seenIndex+'}';
        seen.push(object);

        function join(elements) {
            return indent.slice(1) + elements.join(','+(indent&&'\n')+nextIndent) + (indent ? ' ' : '');
        }

        if (_.isArray(object)) {
            return '[' + join(_.map(object, function(element){
                return walk(element, filter, indent, nextIndent, seen.slice())
            })) + ']';
        }
        var keys = _.keys(object);
        return keys.length ? '{' + join(_.map(keys, function (key) {
            return (legalKey(key) ? key : JSON.stringify(key)) + ':' + walk(object[key], filter, indent, nextIndent, seen.slice())
        })) + '}' : '{}';
    }
};

