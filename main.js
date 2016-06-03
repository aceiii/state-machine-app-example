
var Reqs = {
    defaultTimeout: 1200,
    lookup: function (accountNumber) {
        var d = $.Deferred();

        setTimeout(function () {
            if ((accountNumber || "").indexOf("12345") > -1) {
                console.log("resolving lookup", accountNumber);
                d.resolve({
                    accountNumber: accountNumber,
                    balance: 10.01,
                    amountDue: 10.01,
                    fee: 1.50,
                });
            } else {
                console.log("rejecting lookup", accountNumber);
                d.reject({
                    error: "Account (" + accountNumber + ") not found.",
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

var LoadingViewModel = function() {
    this.template = "loading-template";
};

var LookupViewModel = function(statemgr) {
    this.template = "lookup-template";
    this.statemgr = statemgr;

    this.error = ko.observable();
    this.accountNumber = ko.observable();

    this.lookup = function() {
        this.statemgr.submit(this.accountNumber());
    }.bind(this);
};

var DetailsViewModel = function(statemgr, obj) {
    this.template = "details-template";
    this.statemgr = statemgr;

    obj = ko.toJS(obj || {});

    console.log("details", obj);
    this.accountNumber = obj.accountNumber;
    this.balance = obj.balance;
    this.amountDue = obj.amountDue;
    this.fee = obj.fee;

    this.paymentAmount = ko.observable();

    this.totalAmount = ko.computed(function() {
        var t = +(ko.unwrap(this.paymentAmount)) + ko.unwrap(this.fee);
        if (isNaN(t)) {
            return 0;
        }
        return t;
    }, this);

    this.confirm = function() {
        this.statemgr.submit(ko.toJS(this));
    }.bind(this);

    this.back = function() {
        this.statemgr.cancel();
    }.bind(this);
};

var ConfirmViewModel = function(statemgr, obj) {
    this.template = "confirm-template";
    this.statemgr = statemgr;

    obj = ko.toJS(obj || {});

    this.accountNumber = obj.accountNumber;
    this.paymentAmount = obj.paymentAmount;

    this.payment = function() {
        this.statemgr.submit(obj);
    }.bind(this);

    this.cancel = function() {
        this.statemgr.cancel();
    }.bind(this);
};

var SuccessViewModel = function(statemgr, obj) {
    this.template = "success-template";
    this.statemgr = statemgr;

    obj = obj || {};

    console.log("success", obj);

    this.accountNumber = obj.accountNumber;
    this.paymentAmount = obj.paymentAmount;

    this.reset = function() {
        this.statemgr.reset();
    }.bind(this);
};

var FailureViewModel = function(statemgr, obj) {
    this.template = "failure-template";
    this.statemgr = statemgr;

    obj = obj || {};

    this.error = obj.error;

    this.reset = function() {
        this.statemgr.reset();
    }.bind(this);
};

var App = machina.Fsm.extend({
    initialize: function(options) {
        this.viewmodel = ko.observable();
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
                this.viewmodel(new LoadingViewModel(this));
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
                this.viewmodel(new LookupViewModel(this));
            },
            submit: function(obj) {
                Reqs.lookup(obj).then(this.success.bind(this), this.error.bind(this));
                this.transition("searching");
            },
            error: function(obj) {
                this.viewmodel().error(obj.error);
            },
        },
        searching: {
            _onEnter: function() {
                this.viewmodel(new LoadingViewModel(this));
            },
            success: function(obj) {
                this.deferUntilTransition();
                this.transition("details");
            },
            error: function(obj) {
                this.deferUntilTransition();
                this.transition("lookup");
            },
        },
        details: {
            submit: function(obj) {
                this.transition("confirm");
            },
            success: function(obj) {
                this.viewmodel(new DetailsViewModel(this, obj));
            },
            cancel: function() {
                this.transition("lookup");
            },
        },
        confirm: {
            _onEnter: function() {
                this._details = this.viewmodel();
                this.viewmodel(new ConfirmViewModel(this, this._details));
            },
            submit: function(obj) {
                this._paymentData = obj;
                Reqs.payment(obj).then(this.success.bind(this), this.error.bind(this));
                this.transition("processing");
            },
            cancel: function() {
                delete this._paymentData;
                this.viewmodel(this._details);
                this.transition("details");
            },
        },
        processing: {
            _onEnter: function() {
                this.viewmodel(new LoadingViewModel(this));
            },
            success: function(obj) {
                this.deferUntilTransition();
                this.transition("processed");
            },
            error: function(obj) {
                this.deferUntilTransition();
                this.transition("processed");
            },
        },
        processed: {
            success: function(obj) {
                this.viewmodel(new SuccessViewModel(this, obj));
            },
            error: function(obj) {
                this.viewmodel(new FailureViewModel(this, obj));
            },
            reset: function() {
                this.deferUntilTransition();
                this.transition("lookup");
            },
        },
    },
    reset: function() {
        this.handle("reset");
    },
    start: function() {
        this.handle("start");
    },
    success: function(obj) {
        this.handle("success", obj);
    },
    error: function(obj) {
        this.handle("error", obj);
    },
    submit: function(data) {
        this.handle("submit", data);
    },
    cancel: function() {
        this.handle("cancel");
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
    ko.applyBindings(my_app, document.getElementById("app"));
    console.log("start!");
    my_app.start();
});

