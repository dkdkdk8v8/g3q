/**
 * @brief:俱乐部缓存文件
*/
var ClubService = function(app) {
    this.app = app;
    this.clubs = {};//clubId,club
};


module.exports = ClubService;

ClubService.prototype.addClub = function(club){
    if(! this.clubs[club.clubId]){
        this.clubs[club.clubId] = club;
    }
}

ClubService.prototype.removeClub = function(clubId){
    if(!! this.clubs[clubId]){
        delete this.clubs[clubId]
    }
}

ClubService.prototype.addCluber = function(clubId,uid){
    var club = this.clubs[clubId];
    club.members.push(uid);
    club.memberCnt += 1;
}

ClubService.prototype.getClub = function(clubId){
    return this.clubs[clubId]
}

ClubService.prototype.isClubExist = function(clubId){
    return !! this.clubs[clubId];
}

