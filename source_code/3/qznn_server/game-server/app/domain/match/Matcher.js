
var Match_Status = {
    Apply:1,
    Waitting:2,
    InGame:3
}

var Matcher = function(opts){
    this.uid = opts.uid;
    this.score = opts.score;
    this.rank = opts.rank;
    this.isUpgrade = false;
    this.status = Match_Status.Apply;
    this.applyIndex = opts.applyIndex;//From 1...N
}

Matcher.Match_Status = Match_Status;

module.exports = Matcher;