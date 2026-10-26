
var ServerObjectStream = function (calcDiff) {

    if (typeof calcDiff !== 'function')
        calcDiff = function (obj, prevObj) { return obj; };

    var firstIdx = 0;
    var lastIdx = firstIdx - 1;
    var lastObj = {};
    var queue = {};

    return {
        push: function (obj) {
            var diff = calcDiff(obj, lastObj);
            if (diff) {
                queue[++lastIdx] = diff;
                lastObj = _.clone(obj, true);
            }
        },
        pull: function (fromIdx) {
            if (!queue[fromIdx])
                return null;

            while (firstIdx < fromIdx)
                delete queue[firstIdx++];

            return queue;
        },
        lastObj: function () {
            return lastObj;
        },
        firstIdx: function () {
            return firstIdx;
        },
        lastIdx: function () {
            return lastIdx;
        },
        isNew: function () {
            return lastIdx < 0;
        }
    };
};

var ClientObjectStream = function (patchDiff) {

    //by default, objects are transferred as is
    if (typeof patchDiff !== 'function')
        patchDiff = function (obj, diff) { return diff; };

    var firstIdx = 0;
    var lastIdx = firstIdx - 1;
    var lastObj = {};
    var queue = {};

    return {
        push: function (inQueue) {
            while( inQueue[++lastIdx] ) {
                queue[lastIdx] = patchDiff(lastObj, inQueue[lastIdx]);
                lastObj = JSON.parse(JSON.stringify(lastObj));
            }
            lastIdx--;
        },
        pull: function () {
            if (firstIdx > lastIdx)
                return null;

            var retValue = { firstIdx: firstIdx, lastIdx: lastIdx, objects: queue };
            queue = {};
            firstIdx = lastIdx + 1;
            return retValue;
        },
        lastObj: function () { return lastObj; },
        firstIdx: function () { return firstIdx; },
        lastIdx: function () { return lastIdx; },
        isNew: function () { return lastIdx < 0; },
        isEmpty: function () { return firstIdx > lastIdx; },
        nextIdx: function () { return lastIdx + 1; }
    };
};
