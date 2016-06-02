
var Reqs = {
    defaultTimeout: 1200,
    lookup: function (accountNumber) {
        var d = $.Deferred();

        setTimeout(function () {
            if (accountNumber.indexOf("12345") > -1) {
                console.log("resolving lookup", accountNumber);
                d.resolve({
                    accountNumber: accountNumber,
                    balance: 10.01,
                    amountDue: 10.01,
                });
            } else {
                console.log("rejecting lookup", accountNumber);
                d.reject({
                    error: "Account not found.",
                });
            }
        }, Reqs.defaultTimeout);

        return d.promise();
    },

    payment: function(data) {
        var d = $.Deferred();

        setTimeout(function() {
            if (data.paymentAmount > 0 && data.paymentAmount <= 10.01) {
                d.resolve({
                    accountNumber: data.accountNumber,
                });
            } else {
                d.reject({
                    error: "Invalid payment amount.",
                });
            }
        }, Reqs.defaultTimeout);

        return d.promise();
    },
};

var App = machina.Fsm.extend({
    initialize: function(options) {
        this.viewmodel = {
            state: ko.observable(),
            error: ko.observable(),
            accountNumber: ko.observable(),
            balance: ko.observable(),
            amountDue: ko.observable(),
            paymentAmount: ko.observable(),

            lookup: function() {
                this.lookup(this.viewmodel.accountNumber());
                return false;
            }.bind(this),

            payment: function() {
                this.payment(ko.toJS(this.viewmodel));
                return false;
            }.bind(this),

            confirm: function() {
                this.confirm();
            }.bind(this),

            reset: function() {
                this.reset();
            }.bind(this),
        };
    },
    namespace: "state-app",
    initialState: "uninitialized",
    states: {
        uninitialized: {
            "*": function() {
                this.deferUntilTransition();
                this.transition("loading");
            },
        },
        loading: {
            _onEnter: function() {
                this.viewmodel.state("loading");
            },
            _onExit: function() {
                clearTimeout(this.timeout);
            },
            loaded: "lookup",
            details: "details",
            start: function(obj) {
                this.timeout = setTimeout(function() {
                    this.handle("loaded");
                }.bind(this), (obj || {}).timeout || 200);
            },
        },
        lookup: {
            _onEnter: function() {
                this.viewmodel.state("lookup");
            },
            submit: "searching",
            reset: function() {
                this.viewmodel.error(null);
                this.viewmodel.accountNumber(null);
                this.viewmodel.balance(null);
                this.viewmodel.amountDue(null);
                this.viewmodel.paymentAmount(null);
            },
        },
        searching: {
            _onEnter: function() {
                this.viewmodel.state("loading");
            },
            success: function(obj) {
                this.viewmodel.accountNumber(obj.accountNumber);
                this.viewmodel.balance(obj.balance);
                this.viewmodel.amountDue(obj.amountDue);
                this.transition("details");
            },
            error: function(obj) {
                console.log(arguments);
                this.viewmodel.error(obj.error);
                this.transition("lookup");
            },
        },
        details: {
            _onEnter: function() {
                this.viewmodel.state("details");
            },
            submit: "confirm",
        },
        confirm: {
            _onEnter: function() {
                this.viewmodel.state("confirm");
            },
            submit: "processing",
        },
        processing: {
            _onEnter: function() {
                this.viewmodel.state("loading");
            },
            success: function(obj) {
                this.transition("processed");
            },
            error: function(obj) {
                this.transition("failure");
            },
        },
        processed: {
            _onEnter: function() {
                this.viewmodel.state("processed");
            },
            reset: function() {
                this.deferUntilTransition();
                this.transition("lookup");
            },
        },
        failure: {
            _onEnter: function() {
                this.viewmodel.state("failure");
            },
            reset: function() {
                this.deferUntilTransition();
                this.transition("lookup");
            },
        }
    },
    reset: function() {
        this.handle("reset");
    },
    start: function() {
        this.handle("start");
    },
    lookup: function(accountNumber) {
        console.log("performing lookup on account: " + accountNumber);
        Reqs.lookup(accountNumber)
            .then(function(obj) {
                this.handle("success", obj);
            }.bind(this), function(obj) {
                this.handle("error", obj);
            }.bind(this))
            .catch(function(e) {
                console.error(arguments);
                this.handle("error", {
                    error: e.toString(),
                });
            });
        this.handle("submit");
    },
    payment: function(data) {
        console.log("performing payment on account:", data.accountNumber, "for amount:", data.paymentAmount);
        Reqs.payment(data)
            .then(function(obj) {
                this.handle("success", obj);
            }.bind(this), function(obj) {
                this.handle("error", obj);
            }.bind(this))
            .catch(function(e) {
                console.log(arguments);
                this.handle("error", {
                    error: e.toString(),
                });
            });
        this.handle("submit");
    },
    confirm: function() {
        this.handle("submit");
    },
    reset: function() {
        this.handle("reset");
    },
});

$(function () {
    var my_app = new App();

    my_app.on("transition", function(state) {
        console.log("transition", state.fromState, "->", state.toState);
    });

    window.my_app = my_app;
    console.log(my_app);
    ko.applyBindings(my_app.viewmodel, document.getElementById("app"));
    console.log("start!");
    my_app.start();
});

