//### Global variables for the development build
//
//This file is specifically excluded from index.jss if `production` setting in the [build.js](../build.js.html)
//is set to `true`.

//var demoUserId = 115752; //pan: 115752, me: 119835

/*
var testUpdates = function (customer) {
    if (customer)
        _.each(customer.contracts, function (contract) {
            if (contract && contract.device && contract.device.state && contract.device.state["SATEL_NUM"]) {
                contract.device.state["SATEL_NUM"]++;
                customerUpdateVersion++;
            }
        });
};

*/

production = false;