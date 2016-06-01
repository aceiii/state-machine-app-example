
function App() {
    this.text = ko.observable("Hello World!");
}

$.extend(App.prototype, {
});

$(function () {
    ko.applyBindings(new App(), document.getElementById("app"));
});

