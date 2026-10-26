var buildPath = function (dirSeparator) {
    return function () {
        var path = '';
        var dir;
        for (var i = 0; i < arguments.length; ++i) {
            dir = arguments[i];
            if (dir) {
                var fc = dir[0];
                var lc = dir[dir.length - 1];
                var fi = fc === '\\' || fc === '/' ? 1 : 0;
                var li = lc === '\\' || lc === '/' ? dir.length - 1 : void(0);
                dir = dir.slice(fi, li);
                path += (path ? dirSeparator : '') + dir;
            }
        }
        return path;
    };
};

var root = buildPath('\\')(self.root, request.filepath);

eval_file("scripts\\my_utils.js");
eval_file("scripts\\my_api.js");

eval_file(root + "\\lib\\lodash\\lodash.compat.js");
eval_file(root + "\\lib\\uri.js\\uri.min.js");
eval_file(root + "\\lib\\deparam.js");
eval_file(root + "\\lib\\jsondiff\\jsondiffpatch.js");
eval_file(root + "\\lib\\moment\\moment.js");
eval_file(root + "\\lib\\simplify\\simplify.js");

eval_file(root + "\\stream.js");


jsondiffpatch.config.objectHash = function (obj) { return JSON.stringify(obj); };

var format = function (str, col) {
    col = typeof col === 'object' ? col : Array.prototype.slice.call(arguments, 1);

    return str.replace(/\{\{|\}\}|\{(\w+)\}/g, function (m, n) {
        //use double curly braces for literal single curly braces
        if (m === "{{") return "{";
        if (m === "}}") return "}";
        return col[n];
    });
};

var getLangResource = function (resource, lang) {
    var r = resource;
    if (!r) {
        return '';
    }
    if (typeof r === 'string') {
        return r;
    }
    return r[lang] || r['en'];
};

var getUnixTimestamp = function (strTime) {
    var ts = +moment(strTime);
    return ts > 0 ? ts : 0;
};

var clientTimezone = 0;

var convertFormattedTime = function (str) {
    return moment(str).utcOffset(clientTimezone).format();
};

var app = {};

var production = true;
eval_file(root + "\\dev.js"); //sets production = false;

eval_file(root + "\\brand.config.js");
eval_file("scripts\\raw-data-svc.js");
eval_file(root + "\\data-svc.js");


session = {};
session.accepted = false;


function readFile(fileName) {
    return self.loadfile(root + '\\' + fileName);
}


var calcDiff = function (obj, prevObj) {
    return jsondiffpatch.diff(prevObj, obj);
};

var userDataDirtyFlag = true;
var userData;
var userStream = ServerObjectStream(calcDiff);
var signalStreams = {};

var demoMode = false;

var getBillMode = function (cid) {
    //billMode:
    //0 - do not touch balance
    //1 - reduce sms balance
    //2 - reduce money balance

    var bc = typeof brandConfig !== 'undefined' ? brandConfig : {};
    if (typeof bc.forcedBillMode === 'number') {
        return bc.forcedBillMode;
    }

    var strBillMode = _.find(userData.contracts[cid].svc, function (v) { return v.slice(0, 2) === 'BM'; });
    var billMode = typeof strBillMode === 'string' ? +strBillMode.slice(2) : void(0);

    if (typeof billMode === 'number') {
        return billMode;
    }

    if (typeof bc.defaultBillMode === 'number') {
        return bc.defaultBillMode;
    }

    return 0;
};

var getUserStreamData = function (nextIdx) {
    return userStream.pull(nextIdx);
};

var getSignalStreamsData = function (nextIndexes) {
    nextIndexes = nextIndexes || {};
    var data = {};

    _.each(signalStreams, function (stream, cid) {
        data[cid] = stream.pull(nextIndexes[cid] || 0);
    });

    return data;
};

var pushNewSignal = function (cid, signal) {
    _.merge(userData.fieldDescriptions, signal.fieldDescriptions);
    userDataDirtyFlag = true;
    delete signal.fieldDescriptions;
    signalStreams[cid].push(signal);
};

var versionStringToNumber = function (str) {
    var version = str ? ('' + str) : '0';
    var va = version.split('.');
    va.reverse();
    version = 0;
    _.each(va, function (str, i) {
        version += Math.pow(1000, i) * str;
    });
    return version;
};

// Internal push service runs on the same machine as this server.
var pushServiceUrl = "http://127.0.0.1:18081";
var registeredPushToken = null;

var services = {

    "register": function (data) {
        if( !data.username) {
            throw 'username is missing';
        }

        if (data.phone) {
            data.phone = '7' + data.phone;
        }

//        if (data.mode === 'edit') {
//            return dataService.editUser(data);
//        }

        return dataService.newUser(data);
    },

    "sendPassword": function (data) {
        return dataService.sendPassword(data);
    },

    "resendEmail": function (data) {
        return dataService.resendEmail(data);
    },

    "confirmEmail": function (data) {
        return dataService.confirmEmail(data);
    },

    "login": function (data) {

        //If demoUserId is defined, use it for demo/demo login without actually logging in.
//        if (typeof demoUserId !== "undefined" && data.username === "demo" && data.password === "demo")
//            data.username = demoUserId;

        //debugger;

        clientTimezone = data.timezone; //number in minutes (client timezone as offset from GMT)

        var clientVersion = versionStringToNumber(data.clientVersion);


        if (data.username === 'demo') {
            demoMode = true;
        }

        userData = dataService.getUser(data.username, data.password, self.host);

//        if (!dataService.userVerified(userData)) {
//            var email = dataService.pickEmail(userData, false);
//            return { error: 2, errorMessage: "Email not confirmed", email: email };
//        }

        if (userData) {
            self.need_session(true);

            _.each(userData.contracts, function (contract, cid) {
                var state = contract.device.state;
                if (!state)
                    return;

                delete contract.device.state;

                if (!signalStreams[cid]) {
                    signalStreams[cid] = ServerObjectStream(calcDiff);
                }

                pushNewSignal(cid, state);
            });

            userStream.push(userData);
            userDataDirtyFlag = false;

            var bc = typeof brandConfig !== 'undefined' ? brandConfig : {};

            //JSON.parse(JSON.stringify(obj))
            return {
                sid: session_id,
                userPrivileges: ["user"],
                //templates: templates,
                userStream: getUserStreamData(0),
                signalStreams: getSignalStreamsData(),
                patches: clientVersion <= 1002085 ? bc.patches : null //AlfaSputnik current mobile version
            };
        }

        Sleep(2000);

        return { error: 1, errorMessage: "Username and password do not match" };
    },

    "registerPushToken": function (data) {
        // pendingPushToken belongs to the JS client. Its value arrives as data.token.
        // Never accept person_id from the client: use the authenticated session.
        if (!userData || !userData.id) {
            return { error: 1, errorMessage: "You must log in to register a push token" };
        }
        if (!data || typeof data.token !== "string" ||
                !/^[\x21-\x7e]{1,512}$/.test(data.token) ||
                (data.platform && data.platform !== "android")) {
            return { error: 2, errorMessage: "Invalid Android push token" };
        }

        var personId = +userData.id;
        if (!(personId > 0 && personId <= 2147483647 && Math.floor(personId) === personId)) {
            return { error: 1, errorMessage: "Invalid user session" };
        }
        var payload = { person_id: personId, fcm_token: data.token };
        if (registeredPushToken && registeredPushToken.personId === personId &&
                registeredPushToken.token !== data.token) {
            payload.old_fcm_token = registeredPushToken.token;
        }

        try {
            var responseText = self.download_file(
                pushServiceUrl + "/v1/tokens/register", JSON.stringify(payload));
            var pushResult = self.json_parse(responseText);
            if (!pushResult || pushResult.error || pushResult.registered !== true ||
                    +pushResult.person_id !== personId) {
                return { error: 3, errorMessage: "Push token registration failed" };
            }
        } catch (e) {
            // Do not expose tokens or transport exception details to the client.
            return { error: 3, errorMessage: "Push service is unavailable" };
        }

        registeredPushToken = { personId: personId, token: data.token };
        return { error: 0, registered: true };
    },

    "logout": function () {

        self.need_session(false);
        return "success";
    },

    "addDevice": function (data) {

//        if (demoMode) {
//            return null;
//        }

        var contract = dataService.addDevice(userData.id, data);
        if (!contract) {
            return null;
        }
        userData.contracts[contract.id] = contract;
        if (!userData.cars[contract.carId]) {
            userData.cars[contract.carId] = dataService.transformCar(userapi.get_car_data(contract.carId));
        }
        userDataDirtyFlag = true;


        signalStreams[contract.id] = ServerObjectStream(calcDiff);
        var state = contract.device.state;
        if (state) {
            delete contract.device.state;
            pushNewSignal(contract.id, state);
        }

        return { contractId: contract.id };
    },

    "editAsset": function (asset) {
        //asset = {id, name} (id = carId)
        if (dataService.editAsset(asset)) {
            userData.cars[asset.id].name = asset.name;
            userDataDirtyFlag = true;
            return true;
        }

        return false;
    },

    "removeDevice": function (cid) {
        if (userData.contracts[cid]) {

            delete userData.contracts[cid].device;
            userData.contracts[cid].sim = null;
            userDataDirtyFlag = true;

            dataService.removeDevice(cid);
        }
    },

    "ping": function (data) {
        if (typeof userData.pingCounter !== 'number') {
            userData.pingCounter = 0;
        }

        userData.pingCounter++;
        userDataDirtyFlag = true;
        return true;
    },

    "time": function (data) {
        return moment().toString();
    },

    "update": function (data) {

        if (userDataDirtyFlag) {
            //debugger;
            userStream.push(userData);
            userDataDirtyFlag = false;
        }

        return {
            userStream: getUserStreamData(data.nextUserStreamIndex),
            signalStreams: getSignalStreamsData(data.nextSignalStreamsIndexes)
        };
    },

    "command": function (data) {

        var i = data && data.command && data.command.indexOf && data.command.indexOf('-') || -1;
        if (i === -1)
            return { error: 3, errorMessage: "Invalid parameter" };

        var cid = data.cid;
        var code = data.command.slice(0, i);
        var arg = data.command.slice(i + 1);

        var billMode = getBillMode(cid);

        return dataService.sendCommand(cid, code, arg, billMode);
        //Sleep(4000);
        //return { error: 0, message: 'success' };
    },

    "settings": function (data) {

        return dataService.setSettings(data.cid, data.settings);
    },

    "contractSettings": function (data) {

        dataService.setContractSettings(data.cid, data.settings);
        userData.contracts[data.cid].title = data.settings.title;
        userDataDirtyFlag = true;
    },

    "history": function (data) {

        var res = dataService.getHistory(data.cid, data.type, data.spans);

//        if (data.type === 'alert') {
//            _.each(res, function (eventSpan) {
//                _.each(eventSpan.events, function (e) {
//                    _.merge(userData.fieldDescriptions, e.fieldDescriptions);
//                });
//            });
//        }

        return res;
    },

    "getTimeRange": function (data) {
        return dataService.getTimeRange(data);
    },

    "updateProfile": function (data) {

        var profile = data;
        dataService.updateProfile(userData.id, profile);

        userData.phone = profile.phone;
        userDataDirtyFlag = true;
    },

    "changePassword": function (data) {
        return dataService.changePassword(userData.id, data);
    },

    "getAvailableDates": function (data) {

        var cid = data;
        var res = dataService.getAvailableDates(cid);

        return res;
    },

    "getBillingInfo": function (data) {
        //debugger;
        var billMode = getBillMode(data.cid);

        var bc = typeof brandConfig !== 'undefined' ? brandConfig : {};

        var sms = userapi.get_sms_count_left(data.cid);
        var balance = userapi.get_balance(data.cid);

        return {
            billMode: billMode,
            balance: balance,
            smsLimit: sms.LOCATION_LIMIT,
            smsLeft: sms.LEFT_REQ,
            paylink: bc.paylink
        };
    }

//    ,
//    "ready_for_install": function () {
//        return userapi.ready_for_install();
//    }
};

var protectedServices = [
    'registerPushToken',
    'addDevice',
    'update',
    'command',
    'settings',
    'contractSettings',
    'history',
    'getAvailableDates',
    'removeDevice',
    'updateProfile',
    'changePassword',
    'getTimeRange',
    'getBillingInfo',
    'editAsset'
];

function handle_request(request) {

    //var params = request.params;
    var params = deparam(new URI(request.url).query(), false);
    //TODO: deparam POST requests

    self.need_session(params.sid == session_id);

    var result;

    try {
        db.t_start();

        if (params.name === 'confirmEmailPage') {
            var confirmEmailTitle = { en: 'Email Confirmation', ru: 'Подтверждение адреса эл. почты' };
            var confirmEmailSuccessMessage = { en: 'Your email is now confirmed. You can use it along with the password you specified at registration to log in to the application.', ru: 'Ваш адрес электронной почты подтвержден. Вы можете теперь использовать этот адрес и пароль, указанный при регистрации, для входа в приложение.' };
            var confirmEmailErrorMessage = { en: 'This email activation link is not valid', ru: 'Данная ссылка для активации адреса электронной почты не верна' };

            var confirmed = dataService.confirmEmail(params.key);

            var confirmHtml = readFile('confirm.html');
            response.body = format(confirmHtml, {
                title: getLangResource(confirmEmailTitle, params.lang),
                message: getLangResource(confirmed ? confirmEmailSuccessMessage : confirmEmailErrorMessage, params.lang)
            });
            return;
        }

        if (params.name) {
            var service = services[params.name];
            if (service) {
                if (_.indexOf(protectedServices, params.name) !== -1 &&
                        (!userData || (params.name === 'registerPushToken' &&
                            (!params.sid || params.sid != session_id)))) {
                    result = { name: params.name, data: { error: 1, errorMessage: "You must log in to access this service" } };
                }
                else {
                    result = { name: params.name, data: service.call(services, params.data) };
                }
            }
            else {
                result = { name: "server", data: { error: 2, errorMessage: "The service " + params.name + " was not found" } }
            }
        }
        else {
            result = { name: "server", data: { error: 1, errorMessage: "The name parameter was missing from the request" } }
        }

        db.t_commit();
    }
    catch (e) {
        db.t_rollback();
        result = {
            name: "server",
            data: {
                error: 3,
                errorMessage: "An exception was raised while processing the request",
                exception: production ? 'Server exception data not provided for security reasons' : e
            }
        };
    }

    if (typeof params.jsonp === "string") {
        self.add_custom_header("Content-Type", "application/javascript; charset=utf-8");
        response.body = params.jsonp + "(" + JSON.stringify(result) + ");";
    }
    else {
        self.add_custom_header("Content-Type", "application/json; charset=utf-8");
        self.add_custom_header("Access-Control-Allow-Origin", "*");
        //Logg("Access-Control-Allow-Origin");
        return result;
    }
}

var getUsersContractId = function (sevenSignal) {

    var cid = "" + sevenSignal["CONTRACT_ID"];
    var contract = userData.contracts[cid];

    if (!contract || !contract.device || !contract.device.id)
        return null;

    return cid;
};

function process_message2(type, data)
{
    //debugger;

    if (!userData)
        return;

    if (type === "7_UNIVERSAL" && data["7SIGNAL____"])
    {
        db.do_connect();
        t_start(function () {
            //var sevenSignal = data["7SIGNAL____"];
            Logg("data.db_id="+data.db_id);
            var sevenSignal = db.run_query("select * from GET_SIGNAL(:p1)", {p1: data.db_id}, false)[0].TXT1;

            var cid = getUsersContractId(sevenSignal);
            if (!cid)
                return;

            var signal = dataService.transformSevenSignal(sevenSignal);
            pushNewSignal(cid, signal);
        });
    }

    if (type === 'LBS_DETECTED') {

        db.do_connect();
        t_start(function () {
            //var sevenSignal = data;
            var sevenSignal = db.run_query("select * from GET_SIGNAL(:p1)", {p1: data.MESSAGE_ID}, false)[0].TXT1;

            sevenSignal['IS_LBS'] = 1;
            var cid = getUsersContractId(sevenSignal);
            if (!cid)
                return;

            var signal = dataService.transformSevenSignal(sevenSignal);
            pushNewSignal(cid, signal);
        });
    }

    if (type == 'SETTINGS_UPDATED') {
        var cid = data.cid;
        var settings = data.settings;

        var contract = userData.contracts[cid];
        contract.settings = dataService.transformSettings(cid, settings);

        userDataDirtyFlag = true;
    }
}

app.process_message2 = process_message2;


