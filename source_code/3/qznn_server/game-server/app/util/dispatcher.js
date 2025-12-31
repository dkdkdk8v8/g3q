
module.exports.dispatch = function(id, svrs) {
	var index = Number(id) % svrs.length;
	return svrs[index];
};
