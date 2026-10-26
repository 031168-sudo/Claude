//### This file defines `dataService` global object
//
//`dataService` global object provides single point intersection between the application logic and the underlying
//services of the Signal Server.

if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^\s+|\s+$/g, '');
    };
}

var dataService = (function () {

    var exp = {};

    exp.getAvailableDates = function (cid) {
        return _.map(userapi.daysWithAvailableData(cid, clientTimezone), function (obj) {
            return +obj['DATE1'] / 100000;
        });
    };

    var getFieldId = function (name) {
        return name.slice(0, name.indexOf(','))
            .trim()
            .toLocaleLowerCase();
    };

    /**
    * #### transformSevenSignal
    *
    * Convert original raw sevenSignal object into its streamlined representation used throughout the app.
    *
    * The conversions:
    *
    * The extra properties arrays DLINES and ALINES are flattened into normal key/value properties
    * ('DLINES+ID': STATUS_RES) of the output sevenSignal object and their
    * descriptions are extracted into a separate object *fieldDescriptions* which is returned along with *sevenSignal*
    * in the output object. The BODY and ANALOG_OUTPUT fields are removed.
    *
    * @param {object} inSevenSignal raw sevenSignal object
    * @return {object} processed sevenSignal with extracted fieldDescriptions:
    * ```
    * {
    *     sevenSignal: {},
    *     fieldDescriptions: {}
    * }
    * ```
    * *fieldDescriptions* contains meta-information extracted from DLINES and ALINES:
    * ```
    * {
    *    fieldName: {
    *        name: 'human readable name',
    *        values: {
    *            someValue: 'display value'
    *        }
    *    }
    * }
    * ```
    */
    var transformSevenSignal = exp.transformSevenSignal = function (inSevenSignal) {

        //debugger;

        if (!inSevenSignal)
            return null;

        var fieldDescriptions = {};
        var outSevenSignal = {};

        //Order fields this way:
        if (inSevenSignal['MESSAGE_ID'])
            outSevenSignal['MESSAGE_ID'] = 0;

        if (inSevenSignal['MESSAGE_TYPE'])
            outSevenSignal['MESSAGE_TYPE'] = 0;

        if (inSevenSignal['IS_ALERT'])
            outSevenSignal['IS_ALERT'] = 0;

        if (inSevenSignal['SERVER_TIME'])
            outSevenSignal['SERVER_TIME'] = 0;

        if (inSevenSignal['UNIT_TIME'])
            outSevenSignal['UNIT_TIME'] = 0;

        if (inSevenSignal['GPS_TIME'])
            outSevenSignal['GPS_TIME'] = 0;

        if (inSevenSignal['LATITUDE'])
            outSevenSignal['LATITUDE'] = 0;

        if (inSevenSignal['LONGITUDE'])
            outSevenSignal['LONGITUDE'] = 0;

        if (inSevenSignal['IS_LBS'])
            outSevenSignal['IS_LBS'] = 0;

        if (inSevenSignal['LBS_LAT'])
            outSevenSignal['LBS_LAT'] = 0;

        if (inSevenSignal['LBS_LON'])
            outSevenSignal['LBS_LON'] = 0;

        _.each(inSevenSignal, function (value, key) {
            if (typeof value === "object") {

                if (key === "DLINES") {
                    _.each(value, function (obj) {
                        //var key = "DLINES" + obj["ID"];
                        //var key = getFieldId(obj['NAME']);
                        var key = obj['VAR_NAME'] || getFieldId(obj['NAME']); //NAME = NAME_RUS, VAR_NAME = NAME_ENG
                        var value = obj["STATUS_RES"];
                        outSevenSignal[key] = value;

                        var values = {};
                        values[value] = obj["VAR_RES_ENG"] ? { 'en': obj["VAR_RES_ENG"], 'ru': obj["VAR_RES"] } : obj["VAR_RES"];

                        fieldDescriptions[key] = {
                            name: obj["NAME"],
                            //name: key,
                            values: values
                        };
                    });
                    return;
                }

                if (key === "ALINES") {
                    //var versionId = +inSevenSignal["VERSION_ID"];
                    _.each(value, function (obj) {
                        //var key = "ALINES" + (versionId * 1000 + +obj["CODE"]);
                        //var key = getFieldId(obj["NAME"]);
                        var key = obj['VAR_NAME'] || getFieldId(obj['NAME']);
                        var value = inSevenSignal["ANALOG_OUTPUT" + (+obj["CODE"] - 100)];
                        outSevenSignal[key] = value;
                        fieldDescriptions[key] = {
                            name: obj["NAME"]
                            //name: key
                        };
                    });
                    return;
                }

                return;
            }

            if (key === 'REASON_TXT') {
                if (inSevenSignal['REASON_TXT_ENG']) {
                    value = { 'ru': value, 'en': inSevenSignal['REASON_TXT_ENG'] };
                }
            }

            if (key === 'REASON_TXT_ENG')
                return;

            if (key === 'MODE_TXT') {
                if (inSevenSignal['MODE_TXT_ENG']) {
                    value = { 'ru': value, 'en': inSevenSignal['MODE_TXT_ENG'] };
                }
            }

            if (key === 'MODE_TXT_ENG')
                return;

            if (key.indexOf("ANALOG_OUTPUT") !== -1)
                return;

            if (key === "BODY") {
                if (typeof value === 'string' && value.slice(0, 4) === 'INF:') {
                    outSevenSignal['INF'] = value.slice(4);
                }
                return;
            }

            if (key === 'SERVER_TIME' || key === 'GPS_TIME' || key === 'UNIT_TIME')
                value = convertFormattedTime(value);

            outSevenSignal[key] = value;
        });

        //outSevenSignal['LBS_LAT'] = outSevenSignal['LBS_LON'] = outSevenSignal['LATITUDE'] = outSevenSignal['LONGITUDE'] = 0;

        //outSevenSignal.orgSevenSignal = inSevenSignal;

        if (outSevenSignal['LATITUDE'] === 0 && outSevenSignal['LONGITUDE'] === 0)
            delete outSevenSignal['SPEED_DIRECTION'];

        if (typeof brandConfig !== 'undefined' && brandConfig.treatTrackAsAlert) {
            outSevenSignal['IS_ALERT'] = true;
        }

        var type = outSevenSignal['IS_ALERT'] ? 'alert' : 'track';
        if (outSevenSignal['MESSAGE_TYPE'] == 3) {
            type = 'alert';
        }

        return {
            type: type,
            dt: getUnixTimestamp(outSevenSignal[type === 'alert' ? 'SERVER_TIME' : 'GPS_TIME']),
            latlon: {
                'gps': [outSevenSignal['LATITUDE'], outSevenSignal['LONGITUDE']],
                'lbs': [outSevenSignal['LBS_LAT'], outSevenSignal['LBS_LON']]
            },
            sevenSignal: outSevenSignal,
            fieldDescriptions: fieldDescriptions
        };
    };


    //MODE='SUT' - the time can be calculated based on baseTime and frequency
    //MODE='POISK' - last message time plus 5 min plus sensorTimeout


    var getNextTime = function (cid, s) {
        var currentTime = moment();
        var nextTime;

        if (s.mode === 'SUT') {
            var h = s.startTime.slice(0, 2);
            var m = s.startTime.slice(2);

            nextTime = moment().startOf('day').add(h, 'h').add(m, 'm');
            var period = 24 / s.multiplier;
            while (currentTime.isBefore(nextTime)) {
                nextTime.subtract(period, 'h');
            }

            return nextTime.add(period, 'h');
        }

        if (s.mode === 'POISK') {
            return moment();
        }

        if (s.mode === 'TEST') {
            var arr = userapi.getAlertHistory(cid, null, null, false, false, 1);

            if (!arr.length) {
                return moment().add(1, 'h');
            }

            var signal = transformSevenSignal(arr[0]);
            nextTime = moment(signal.SERVER_TIME);
            while(nextTime.isBefore(currentTime)) {
                nextTime.add(1, 'h');
            }
            return nextTime;
        }
    };

    var settingsMockup800 = (function () {
        var s = {};

        s.deviceSettings = {
            startTime: '1251',
            multiplier: 2,
            daysToSkip: 3,
            motionSensor: {
                mode: 0,
                start: '0730',
                end: '1830',
                timeout: 10
            }
        };

        s.serverSettings = _.cloneDeep(s.deviceSettings);
        s.applyTime = moment().format();
        s.nextTime = moment().add(3, 'h').format();

        return {
            getSettings: function () {
                return s;
            },
            setSettings: function (cid, clientSettings) {
                _.extend(s.serverSettings, _.pick(clientSettings, _.identity));
                s.applyTime = moment().format();
                s.nextTime = moment().add(3, 'h').format();
                process_message2('SETTINGS_UPDATED', { cid: cid, settings: s });
            }
        };
    })();


    var settingsMockup806 = (function () {
        var s = {};

        s.deviceSettings = {
            '24': '1251', //базовое время
            '12': 2, //частота в день
            'N': 3, //кол. пропусков
            '38': 0, //режим охраны
            '47': 5,
            'T': 40,
            'D': 10,
            'S': 1,
            '60': 0
        };

        s.serverSettings = _.cloneDeep(s.deviceSettings);
        s.applyTime = moment().format();
        //s.nextTime = moment().add(3, 'h').format();

        return {
            getSettings: function () {
                return s;
            },
            setSettings: function (cid, clientSettings) {
                _.extend(s.serverSettings, _.pick(clientSettings, _.identity));
                s.applyTime = moment().format();
                //s.nextTime = moment().add(3, 'h').format();
                app.process_message2('SETTINGS_UPDATED', { cid: cid, settings: s });
            }
        };
    })();

    var transformSettings = exp.transformSettings = function (cid, s) {
        return {
            deviceSettings: s.DEVICESETTINGS,
            serverSettings: s.SERVERSETTINGS,
            applyTime: convertFormattedTime(s.APPLYTIME && moment(s.APPLYTIME).format())
        };
    };

    var getContractTitle = function (contract) {
        var install = contract["INSTALL"];
        var unit = contract["UNIT"];
        var vid = unit && unit["VERSION_ID"];

        return contract["STARCOM_CONTRACT_NAMBER"]
            || brandConfig.getVersionTitle && vid && brandConfig.getVersionTitle(vid)
            || install && install["VER_TITLE"];
    };

    var transformContract = function (contract) {
        var id = "" + contract["ID"];
        var install = contract["INSTALL"];
        var unit = contract["UNIT"];
        var lastSignal = contract["LAST_SIGNAL"];
        var lastSevenSignal = lastSignal ? lastSignal["7SIGNAL____"] : null;

        var outContract = {
            id: id,
            startDate: contract["BEGIN_DATE"],
            expireDate: contract["EXPIRE_DATE"],
            paypin: contract["PAYMENT_PIN"],
            balance: contract["BALANCE"],
            svc: contract['SVC'], //array of strings (list of services available for this contract)
            sim: install && install["SIM"],
            title: getContractTitle(contract),
            carId: "" + contract["CAR_ID"],
            availableDates: install && install["SIM"] ? null : [],
            device: {}
        };

        if (unit) {
            outContract.device = {
                id: "" + unit["ID"],
                version: "" + unit["VERSION_ID"],
                serial: unit["SERIAL"],
                mode: unit["MODE"],
                state: transformSevenSignal(lastSevenSignal)
            };

            outContract.settings = transformSettings(id, unit["SETTINGS"]);
            //outContract.settings = settingsMockup806.getSettings();
        }

        return outContract;
    };

    exp.setSettings = function (cid, settings) {
        return userapi.setSettings(cid, settings);
        //settingsMockup806.setSettings(cid, settings);
    };

    exp.setContractSettings = function (cid, settings) {
        userapi.contract_update(cid, { 'STARCOM_CONTRACT_NAMBER': settings.title });
    };

    var transformCar = exp.transformCar = function (car) {
        var id = "" + car["ID"];

        if (!id) {
            return null;
        }

        return {
            id: id,
            name: car["RE_TITLE"],
            license: car["NUMBER"],
            year: car["RELEASE_YEAR"],
            vin: car["VIN"]
        };
    };

    /**
     * #### transformCustomerData
     *
     * Transforms raw customer object as returned by `userapi.get_init_info()` into a session object with the
     * following structure:
     * ```
     * {
     *     name: NAME,
     *     phone: M_PHONE,
     *     contacts: [{type: PHONES.TYPE_ID, value: PHONES.TITLE}],
     *     cars: {
     *         CARS.ID: {
     *             id: CARS.ID,
     *             name: CARS.RE_TITLE,
     *             license: CARS.NUMBER,
     *             year: CARS.RELEASE_YEAR,
     *             vin: CARS.VIN
     *         }
     *     },
     *     contracts: {
     *         CONTRACTS.ID: {
     *             id: CONTRACTS.ID,
     *             startDate: CONTRACTS.BEGIN_DATE,
     *             endDate: CONTRACTS.EXPIRE_DATE,
     *             paypin: CONTRACTS.PAYMENT_PIN,
     *             balance: BALANCE,
     *             sim: CONTRACTS.INSTALL.SIM,
     *             carId: CONTRACTS.CAR_ID,
     *             device: {
     *                 id: CONTRACTS.UNIT.ID,
     *                 version: VERSION_ID,
     *                 serial: SERIAL,
     *                 state: <transformed sevenSignal object>
     *             }
     *         }
     *     },
     *     fieldDescriptions: {},
     * }
     * ```
     * *fieldDescriptions* contains field descriptions of stationary sevenSignal fields merged with field descriptions
     * extracted from ALINES and DLINES. Field descriptions of new sevenSignal objects arriving at the server should
     * be merged to this property on ongoing basis.
     *
     * *templates* refers to the [`templates`](templates.js.html) global object that currently stores all built-in templates.
     *
     * @param inCustomer raw customer object
     * @return {Object} transformed customer object
     */
    var transformCustomerData = function (inCustomer) {

        if (!inCustomer)
            return null;

        var convertPhone = function (phone) {
            var p = '' + phone;
            if (p.length > 10) {
                return p.slice(1);
            }

            return p;
        };

        var outCustomer = {
            id: inCustomer["ID"],
            name: inCustomer["NAME"],
            phone: convertPhone(_.trim(inCustomer["M_PHONE"])),
            contacts: [],
            cars: {},
            contracts: {},
            requirePasswordReset: inCustomer['RESET_PASS'],
            emailConfirmed: inCustomer['EMAIL_CONFIRMED'],
            fieldDescriptions: {
                "UNIT_TIME": { name: "Время" },
                "MODE_TXT": { name: "Режим" },
                "ODOMETR": { name: "Одометр" },
                "SATEL_NUM": { name: "Спутники" },
                "SPEED": { name: "Скорость" },
                "IGNITION": { name: "Зажигание"/*, values: { "0": "выкл", "1": "вкл" }*/ }
            }
        };

        if (!production) {
            outCustomer.originalCustomer = inCustomer;
        }

        _.each(inCustomer["PHONES"], function (contact) {
            outCustomer.contacts.push({
                type: contact["TYPE_ID"],
                value: contact["TITLE"]
            });
        });

        _.each(inCustomer["CARS"], function (car) {
            var c = transformCar(car);

            if (c) {
                outCustomer.cars[c.id] = c;
            }
        });

        _.each(inCustomer["CONTRACTS"], function (contract) {
            var c = transformContract(contract);
            outCustomer.contracts[c.id] = c;
        });

        return outCustomer;
    };

    exp.addDevice = function (userId, data) {
        var r = userapi.add_device2({ version: data.vid, phone: data.phone, password: data.password, carId: data.asset, carName: data.assetName, serial: data.serial }, userId, { TITLE: data.name });
        if (r.error || !r.data) {
            return null;
        }
        var cid = r.data;
        var contract = userapi.get_contract(cid);
        return transformContract(contract);
    };

    exp.removeDevice = function (cid) {
        userapi.remove_device(cid);
    };

    exp.editAsset = function (asset) {
        if (userapi.edit_car) {
            return userapi.edit_car(asset);
        }
        return false;
    };

    var sendEmail = function (to, subject, body) {
        mailto__(to, subject, body);
    };

    function generatePassword () {
        var length = 6;
        //var charset = "abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var charset = "0123456789";
        var retVal = "";
        for (var i = 0, n = charset.length; i < length; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
        return retVal;
    }

    var sendPasswordByEmail = function (data) {
        //You recently registered an account at {productName}.\n
        //Вы успешно зарегистрировались в {productName}.\n
        var mlr = {
            subject: {
                en: 'Your username and password for {productName}',
                ru: 'Ваши имя пользователя и пароль для входа в {productName}'
            },
            body: {
                en: 'Use the following credentials to log in to your account:\n\nUsername: {username}\nPassword: {password}',
                ru: 'Для входа в приложение используйте следующие реквизиты:\n\nЛогин: {username}\nПароль: {password}\n'
            }
        };

        var tmplSubject = getLangResource(mlr.subject, data.language);
        var tmplBody = getLangResource(mlr.body, data.language);

        var product = brandConfig.productName || 'PRODUCT';

        var subject = format(tmplSubject, {
            productName: product
        });

        var body = format(tmplBody, _.extend({
            productName: product
        }, data));

        sendEmail(data.email, subject, body);
    };

    exp.pickEmail = function (user, verified) {
        var contacts = _.filter(user.PHONES, function (contact) {
            return contact.TYPE_ID === 'e' && (typeof verified === 'undefined' || !verified === !contact.CONFIRMED);
        });

        if (!contacts.length)
            return null;

        return (_.find(contacts, function (contact) {
            return contact === user.C_LOGIN;
        }) || contacts[0]).TITLE;
    };

    exp.sendPassword = function (data) {
        //data.username

        //TODO: search for administrative contact equal to data.email, then find the user associated with this contact

        var user = userapi.find_user({ C_LOGIN: data.email });

        if (!user) {
            return false;
        }

        var email = exp.pickEmail(user);

        var password = user.C_PASS;

        if (user.LAST_LOGIN) {
            password = generatePassword();
            userapi.user_update(user.ID, { C_PASS: password, RESET_PASS: true });
        }

        sendPasswordByEmail({ username: user.C_LOGIN, password: password, language: data.language, email: email });
        return true;
    };

    exp.newUser = function (data) {
        var password = generatePassword();

        var apiData = {
            C_LOGIN: data.username,
            C_PASS: password,
            RESET_PASS: true,
            M_PHONE: data.phone,
            EMAIL: data.email
        };

        var r = userapi.user_create(apiData);

        if (r) {
            sendPasswordByEmail(_.defaults({ password: password }, data));
            return true;
        }

        //debugger;

        //return null if the existing user has no logins
        r = userapi.find_user({ C_LOGIN: data.username });
        if (r && !r.LAST_LOGIN) {
            return null;
        }

        return false;
    };


    ////////////////////////////////////////////////////////////////////////////

    var sendConfirmationEmail = function (email, key, lang) {
        var emailConfirmationSubject = {
            en: 'Confirm your email address',
            ru: 'Подтвердите адрес вашей электронной почты'
        };

        var emailBody = {
            en: 'You recently registered an account at {productName}. Please confirm your email address by clicking the link below:\n{activationLink}',
            ru: 'Для завершения процедуры регистрации в {productName} и подтверждения вашего адреса электронной почты вам необходимо активировать вашу учетную запись, нажав на следующую ссылку:\n{activationLink}\n'
        };

        var subject = getLangResource(emailConfirmationSubject, lang);
        var body = getLangResource(emailBody, lang);

        var name = brandConfig.productName || 'PRODUCT';
        var link = new URI(brandConfig.emailActivationLink || 'BASE_LINK').addQuery('key', key).addQuery('lang', lang).toString();

        body = format(body, {
            productName: name,
            activationLink: link
        });

        sendEmail(email, subject, body);
    };

    exp.updateProfile = function (userId, profile) {
        userapi.user_update(userId, { M_PHONE: profile.phone });
    };

    exp.changePassword = function (userId, data) {
        var op = data.oldPassword;
        var np = data.newPassword;

        var user = userapi.find_user({ ID: userId });
        if (user.C_PASS === op) {
            userapi.user_update(userId, { C_PASS: np, RESET_PASS: false });
            return true;
        }
        return false;
    };

    exp.editUser = function (data) {
        var user = userapi.user_login(data.login, data.password);
        if (!user || !user.ID)
            return false;

        if (data.email) {
            userapi.contact_add({ TYPE_ID: "e", PERSON_ID: user.ID, TITLE: data.email });
        }

        if (data.phone) {
            userapi.user_update(user.ID, { M_PHONE: data.phone });
        }

        return true;
    };

    exp.userVerified = function (user) {
        return !!_.find(user.PHONES, function (contact) {
            return contact.CONFIRMED;
        });
    };

    exp.resendEmail = function (data) {
        if (!data) {
            return false;
        }

        var contact = userapi.contact_find({ TYPE: 'e', TITLE: data.email });
        if (!contact) {
            return false;
        }

        sendConfirmationEmail(data.email, data.language);
        return true;
    };

    exp.confirmEmail = function (data) {

        if (typeof data !== 'string') {
            return false;
        }

        var i = data.lastIndexOf('-');
        var guid = data.slice(0, i);
        var contactId = data.slice(i + 1);

        var user = userapi.find_user({ GUID_ID: guid });
        if (user) {
            userapi.contact_update(contactId, { CONFIRMED: true });
            return true;
        }

        return false;
    };


    //////////////////////////////////////////////////////////////////////////////



    /**
     * #### getUser
     *
     * Logs the user in and, on success, returns customer object. Otherwise returns void.
     *
     * @param username
     * @param password
     * @return {Object} transformed customer
     */
    exp.getUser = function (username, password, ip) {

        var user = userapi.user_login(username, password, ip);
        if (!user || !user.ID)
            return null;

        var customerData = userapi.get_init_info(user.ID);

        //TODO: if it is the first login using a password sent via email, the email can be considered confirmed

        return transformCustomerData(customerData);
    };

    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    //convert dt to a format that moment(dt) will parse
    var prep = function (dt) {
        if (isNumber(dt))
            dt = +dt;

        return dt; // - clientTimezone*60*1000;
    };

    var lastAlertEventsRequest = {};

    var getAlertEvents = function (data) {
        //debugger;

        var cid = data.cid;
        var span = _.clone(data.span);
        var from = span[0] = prep(span[0]);
        var to = span[1] = prep(span[1]);
        var limit = data.limit;

        var r = lastAlertEventsRequest;

        if (r.cid === cid && _.eq(r.span, span)) {
            return r.lastResult;
        }

        var alertOnly = !(typeof brandConfig !== 'undefined' && brandConfig.treatTrackAsAlert);

        var arr = userapi.getAlertHistory(cid, from, to, false, alertOnly, limit && (+limit + 1));

        var events = _.map(arr, function(obj) {
            return transformSevenSignal(obj);
        });

        var limited = false;
        if (limit && arr.length > +limit) {
            events.pop();
            span[0] = events[events.length - 1].dt;
            limited = true;
        }

        r.cid = cid;
        r.span = span;
        r.lastResult = {
            span: span,
            events: events,
            cached: true
        };

        return {
            span: span,
            events: events,
            limited: limited
        };
    };

    exp.getTimeRange = function (data) {
        var eventSpan = getAlertEvents(data);
        return { span: eventSpan.span, limited: eventSpan.limited };
    };

    /**
     * #### getHistory
     *
     * Returns an array of eventSpan objects corresponding to recorded history period.
     *
     * Type description for reference:
     * - LatLon: [lat: Number, lon: Number]
     * - Span: [from, to] //from/to - anything that converts to Date
     * - EventSpan: { span: Span, events: [Event]} //events must be sorted by dt
     * - Event: { dt: Number, latlon: LatLon, sevenSignal: SevenSignal }
     *
     * @param cid
     * @param type 'alert' or 'track'
     * @param spans [from, to] time span
     * @return [{EventSpan}]
     */
    exp.getHistory = function (cid, type, spans) {

        return _.map(spans, function (span) {
            var from = prep(span[0]);
            var to = prep(span[1]);

            var arr;

            if (type === 'track') {
                arr = userapi.getTrackHistory(cid, from, to);

                var events = _.map(arr, function(obj) {
                    return {
                        dt: getUnixTimestamp(convertFormattedTime(obj['GPS_TIME'])),
                        latlon: {
                            'gps': [(+obj['LAT']).toFixed(6), (+obj['LON']).toFixed(6)],
                            'lbs': [(+obj['LBS_LAT']).toFixed(6), (+obj['LBS_LON']).toFixed(6)]
                            //'gps': [obj['LAT'], obj['LON']],
                            //'lbs': [obj['LBS_LAT'], obj['LBS_LON']]
                        }
                    };
                });

                //debugger;

                //var reducedEvents = simplify(events, 0.002); //about 25 meters

                return {
                    span: span,
                    events: events
                };
            }
            else {
                return getAlertEvents({ cid: cid, span: [from, to] });
            }
        });
    };

    /**
     * #### sendCommand
     *
     * Sends command (code,arg) on contractId. Returns void.
     *
     * @param contractId
     * @param code
     * @param arg
     * @param billMode
     */
    exp.sendCommand = function (contractId, code, arg, billMode)
    {

        var r = userapi.sendCommand(contractId, code, arg, billMode);

        var message = '';

        if (r.error == 0) {
            if (billMode === 1) {
                message = {
                    en: format('Сommands left in the current month: {left_req}.', r),
                    ru: format('В текущем месяце осталось команд: {left_req}.', r)
                }
            }
            else if (billMode === 2) {
                message = {
                    en: format('Debet: {debet} rub; Balance: {left_balance} rub.', r),
                    ru: format('Дебет: {debet} руб; Баланс: {left_balance} руб.', r)
                }
            }
        }
        else if (r.error == 1) {
            if (billMode === 1) {
                message = {
                    en: 'Command cannot be sent. You have used up the monthly quota of commands.',
                    ru: 'Команда не может быть отправлена. Вы исчерпали доступный лимит команд в текущем месяце.'
                };
            }
            else if (billMode === 2) {
                message = {
                    en: 'Command cannot be sent. Your balance is insufficient: ' + r.left_balance + ' rub.',
                    ru: 'Команда не может быть отправлена. У вас на балансе недостаточно средств: ' + r.left_balance + ' rub.'
                };
            }
        }
        else {
            message = r.message;
        }

        return { error: r.error, message: message };
    };

    return exp;
})();


