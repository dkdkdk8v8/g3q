/*
 landlords.js

 Copyright (c) 2016

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.


 @author linwb <85177960@qq.com>
 @copyright 爱度 2017.02

 @version 0.1.100
 modify:
 */
(function(global){
    /**
     * Enum for card's types.
     * @readonly
     * @enum {number}
     */
    var CardType = {
        SPADE: 4,     //黑桃'♠'
        HEART: 3,     //红桃'♥'
        CLUB: 2,      //梅花'♣'
        DIAMOND: 1,   //方块'♦'
        NULL: 0       //未知
    }

    /**
     * Enum for card's values.
     * @readonly
     * @enum {number}
     * */
    var CardValue = {
        'Z':15,//小2
        'A': 14,//A
        'K': 13,//K
        'Q': 12,//Q
        'J': 11,//J
        '10': 10,//10
        '9': 9,//9
        '8': 8,//8
        '7': 7,//7
        '6': 6,//6
        '5': 5,//5
        '4': 4,//4
        '3': 3,//3
        'NULL': 0//空
    }

    /**
     * Card is indicate a single card
     * @param {CardValue} value - the card's value
     * @param {CardType}  type  - the card's type
     * @example
     *      var card = new poker.Card(3,1);//方块3
     * @constructor
     */
    var Card = function(value,type){
        if (!(this instanceof Card)) {
            throw new TypeError('Card must be constructed via new');
        }

        this.value = value || CardValue.NULL;
        this.type = type || CardType.NULL;
    }
    /**
     * the empty card
     * @static
     */
    Card.empty = function(){
        if(!global.__card_empty){
            global.__card_empty = new Card();
        }
        return global.__card_empty;
    }
    /**
     * clone a new card from old card,the new card's value and type equals to old one
     * @returns {Card} Returns a new card
     */
    Card.prototype.clone = function() {
        return new Card(this.value,this.type);
    }
    /**
     * Indicates whether two cards is equals or not.
     * @param {Card} other the other card
     * @returns {boolean} <i>true</i> if equals, otherwise <i>false</i>
     */
    Card.prototype.equals = function(other){
        if (!other || !(other instanceof Card)){
            throw TypeError("the other card is not available")
        }
        return this.value == other.value && this.type == other.type;
    }
    /**
     * check up who is bigger than another one
     * @param {Card} other ther other card
     * @returns {number} <i>1</i> bigger than,<i>2</i> smaller than <i>0</i> equals to
     */
    Card.prototype.compareTo=function (other) {
        if (!other || !(other instanceof Card)){
            throw TypeError('the other card is not available');
        }
        if (this.value > other.value)
            return 1;
        if (this.value < other.value)
            return -1;
        return 0;
    }
    /**
     * Indicates the value and type of the card
     * @returns {string} Return the string of the card
     */
    Card.prototype.toString = function() {
        return "Card(" + this.value + "," + this.type + ")";
    };
    /**
     * Enum for order's types.
     * @readonly
     * @enum {number}
     */
    var  Order = {
        NULL : 0 ,//未排序
        ASC  : 1,//正序
        DESC : 2//倒序
    }
    /**
     * Enum for multi cards's types.
     *  牌型
     * 1 单支（一手牌）：单张牌，如一支3。
     * 2 对子（一手牌）：相同点数的两张牌在一起的牌型，比如55。
     * 3 连对：两对或两对以上相连的牌，如：33 44，99 88。2不能出现在连对里。
     * 4 三条：相同点数的三张牌在一起的牌型，比如三条4。-------不参与真正牌型
     * 5 三带二：三张牌点相同的牌，带上一个对子或者2个点数不同的单张，如：55577或55567。
     * 6 三顺：二个或更多的连续三条组成的牌型，比如777888或444555666777。2不可以连。
     * 7 飞机：两个或以上数量的三带二，如：555666+7788或者555666789J；没打完的情况下必须带满4张牌，只有在最后牌数不足的情况下可以不带满。2不能出现在连续的三张里。
     * 8 顺子：五张或五张以上牌点连续的牌，花色不限。例如：3、4、5、6、7、8。2不能出现在顺子里。
     * 9 炸弹：相同点数的四张牌在一起的牌型，比如四条A。它可以大过任何其它牌型，炸弹对炸弹时，要比大小
     * @readonly
     * @enum {number}
     * */
    var PokerType = { //多张牌牌型
        NULL                        : 0,//空
        SINGLE                      : 1,//单支
        PAIR                        : 2,//一对
        PAIR_SEQUENCE               : 3,//双顺
        THREE_BAR                   : 4,//三条
        THREE_BAR_WITH_TWO          : 5,//三带二
        THREE_SEQUENCE              : 6,//三顺
        THREE_SEQUENCE_WITH_WING    : 7,//飞机,飞机带翅膀
        SINGLE_SEQUENCE             : 8,//顺子
        BOMB_WITH_THREE_SINGLE      : 9,//四带三张
        BOMB                        : 10,//炸弹
    }

    /**
     * add the function create to Object
     */
    if(typeof Object.create !== 'function'){
        Object.create = function(o){
            function F(){}
            F.prototype = o;
            return new F();
        }
    }
    /**
     * add the function forEach to the prototype of array
     */
    if (typeof Array.prototype.forEach != "function") {
        Array.prototype.forEach = function (fn, context) {
            for (var k = 0, length = this.length; k < length; k++) {
                if (typeof fn === "function" && Object.prototype.hasOwnProperty.call(this, k)) {
                    fn.call(context, this[k], k, this);
                }
            }
        };
    }
    /**
     * add the function map to the prototype of array
     */
    if (typeof Array.prototype.map != "function") {
        Array.prototype.map = function (fn, context) {
            var arr = [];
            if (typeof fn === "function") {
                for (var k = 0, length = this.length; k < length; k++) {
                    arr.push(fn.call(context, this[k], k, this));
                }
            }
            return arr;
        };
    }
    /**
     * add the function filter to the prototype of array
     */
    if (typeof Array.prototype.filter != "function") {
        Array.prototype.filter = function (fn, context) {
            var arr = [];
            if (typeof fn === "function") {
                for (var k = 0, length = this.length; k < length; k++) {
                    fn.call(context, this[k], k, this) && arr.push(this[k]);
                }
            }
            return arr;
        };
    }
    /**
     * add the function some to the prototype of array
     */
    if (typeof Array.prototype.some != "function") {
        Array.prototype.some = function (fn, context) {
            var passed = false;
            if (typeof fn === "function") {
                for (var k = 0, length = this.length; k < length; k++) {
                    if (passed === true) break;
                    passed = !!fn.call(context, this[k], k, this);
                }
            }
            return passed;
        };
    }
    /**
     * add the function every to the prototype of array
     */
    if (typeof Array.prototype.every != "function") {
        Array.prototype.every = function (fn, context) {
            var passed = true;
            if (typeof fn === "function") {
                for (var k = 0, length = this.length; k < length; k++) {
                    if (passed === false) break;
                    passed = !!fn.call(context, this[k], k, this);
                }
            }
            return passed;
        };
    }
    /**
     * add the function indexOf to the prototype of array
     */
    if (typeof Array.prototype.indexOf != "function") {
        Array.prototype.indexOf = function (searchElement, fromIndex) {
            var index = -1;
            fromIndex = fromIndex * 1 || 0;

            for (var k = 0, length = this.length; k < length; k++) {
                if (k >= fromIndex && this[k] === searchElement) {
                    index = k;
                    break;
                }
            }
            return index;
        };
    }
    /**
     * add the function lastIndexOf to the prototype of array
     */
    if (typeof Array.prototype.lastIndexOf != "function") {
        Array.prototype.lastIndexOf = function (searchElement, fromIndex) {
            var index = -1, length = this.length;
            fromIndex = fromIndex * 1 || length - 1;

            for (var k = length - 1; k > -1; k-=1) {
                if (k <= fromIndex && this[k] === searchElement) {
                    index = k;
                    break;
                }
            }
            return index;
        };
    }

    /**
     * inherites from super
     * @param {Object} subType   - the child class
     * @param {Object} superType - the parent class
     */
    var inherits = function(subType,superType){
        var prototype = Object.create(superType.prototype);
        prototype.constructor = subType;
        subType.prototype = prototype;
    }


    /**
     * the base of multi cards,
     * @param {Array} list the array of card
     * @constructor
     */
    var Cards = function(list){
        if (typeof this !== 'object') {
            throw new TypeError('Cards must be constructed via new');
        }
        if(!!list){
            for(var i=0;i<list.length;i++){
                if(!list[i]){
                    throw new Error('there is a null or undefined in list,You may be in the new card array, more with(,)')
                }
                if(!(list[i] instanceof Card)){
                    var value = list[i].value;
                    var type = list[i].type;
                    if(!value || !type){
                        throw new Error('there is a null or undefined in list.object')
                    }
                    list[i] = new Card(value,type);
                }
            }
        }
        this.list = list || [];
        this.order = Order.NULL;
        this.pokerType = PokerType.NULL;
        this.checked = false;
        this.isLast = false;
        var self = this;
        Object.defineProperty(this, "size", {
            configurable: true,
            enumerable: true,
            get: function () {
                return self.list.length;
            }
        });
    }
    /**
     * 克隆多张牌
     * @returns {Object} Returns a new cards object
     */
    Cards.prototype.clone = function() {
        var other = Object.create(this);
        other.list = [];
        for(var i=0;i<this.list.length;i++){
            other.push(this.list[i]);
        }
        // for(var i in this.list) {
        //     other.push(this.list[i]);
        // }
        other.order = this.order;
        other.pokerType = this.pokerType;
        other.isLast = this.isLast;
        Object.defineProperty(other, "size", {
            get: function () {
                return other.list.length;
            }
        });
        return other;
    }
    /**
     * 是否存在四张一样的牌
     * @returns {boolean} Returns <i>true</i> have more than one,<i>false</i> have none
     */
    Cards.prototype.existsFour = function() {
        var cardNumber;
        for (var i = 0; i < this.list.length; i++) {
            var c = this.list[i];
            cardNumber = 0;
            for (var j = 0; j < this.list.length; j++) {
                var card = this.list[j];
                if (c.value === card.value){
                    cardNumber++;
                }
                if (cardNumber >= 4){
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * 是否存在三条
     * @returns {boolean} Returns <i>true</i> have more than one,<i>false</i> have none
     */
    Cards.prototype.existsThree = function() {
        var cardNumber;
        for (var i = 0; i < this.list.length; i++) {
            var c = this.list[i];
            cardNumber = 0;
            for (var j = 0; j < this.list.length; j++) {
                var card = this.list[j];
                if (c.value === card.value)
                    cardNumber++;
                if (cardNumber >= 3)
                    return true;
            }
        }
        return false;
    }
    /**
     * 是否存在对子
     * @returns {boolean} Returns <i>true</i> have more than one,<i>false</i> have none
     */
    Cards.prototype.existsPair = function() {
        var cardNumber;
        for (var i = 0; i < this.list.length; i++) {
            var c = this.list[i];
            cardNumber = 0;
            for (var j = 0; j < this.list.length; j++) {
                var card = this.list[j];
                if (c.value === card.value)
                    cardNumber++;
                if (cardNumber >= 2)
                    return true;
            }
        }
        return false;
    }
    /**
     * 是否存在三条
     * @returns {boolean} Returns <i>true</i> have more than one,<i>false</i> have none
     */
    Cards.prototype.existsThreeBar = function() {
        var cardNumber;
        for(var i=0;i<this.size;i++){
            var c = this.list[i];
            cardNumber = 0;
            for(var j=0;j<this.size;j++){
                var card = this.list[j];
                if (c.value == card.value){
                    cardNumber++;
                }
                if (cardNumber >= 3){
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * 是否存在四条
     * @returns {boolean} Returns <i>true</i> have more than one,<i>false</i> have none
     */
    Cards.prototype.existsFourBar = function() {
        var cardNumber;
        for(var i=0;i<this.size;i++){
            var c = this.list[i];
            cardNumber = 0;
            for(var j=0;j<this.size;j++){
                var card = this.list[j];
                if (c.value == card.value){
                    cardNumber++;
                }
                if (cardNumber >= 4){
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * search the number of cards by card's value
     * @param {CardValue|number} cardValue
     * @returns {number}
     */
    Cards.prototype.findNumberByValue = function(cardValue){
        var number = 0;
        for(var i=0;i<this.size;i++){
            var card = this.list[i];
            if (card.value == cardValue){
                number++;
            }
        }
        return number;
    }
    /**
     * the number of four
     * @returns {number} Returns the number of four
     */
    Cards.prototype.findFourNumber = function() {
        var cList = this;
        if(!this.order || this.order === Order.NULL){
            var cList = this.clone();
            cList.sort();
        }
        var count = 0;
        for (var i = 0; i <= cList.list.length - 4; i++) {
            var card1 = cList.list[i];
            var card2 = cList.list[i + 1];
            var card3 = cList.list[i + 2];
            var card4 = cList.list[i + 3];
            if (card1.value === card2.value && card2.value === card3.value && card3.value === card4.value)  {
                i += 3;
                count++;
            }
        }
        return count;
    }
    /**
     * is the same of flower
     * @returns {boolean} Returns <i>true</i> the same<i>false</i> otherwise
     */
    Cards.prototype.isSameFlower = function() {
        if (this.list.length <= 1)
            return false;
        var card0 = this.list[0];
        for (var i = 0; i < this.list.length; i++) {
            if (this.list[i].type!==card0.type)
                return false;
        }
        return true;
    }
    /**
     * is sequence
     * @returns {boolean} Returns <i>true</i> is sequence<i>false</i> otherwise
     */
    Cards.prototype.isSequence = function(){
        if (this.size <= 1)
            return false;
        if (this.exists(CardValue.Z))
            return false;
        this.sort();
        for (var i = 1; i < this.size; i++) {
            var j = this.list[i].value - this.list[0].value;//间隔
            if (Math.abs(j) != i)
                return false;
        }
        return true;
    }
    /**
     * find the number of three
     * @returns {number} Return the number of three
     */
    Cards.prototype.findThreeNumber = function() {
        var cList = this;
        if(!this.order || this.order === Order.NULL){
            var cList = this.clone();
            cList.sort();
        }
        var count = 0;
        for (var i = 0; i <= cList.list.length - 3; i++) {
            var card1 = cList.list[i];
            var card2 = cList.list[i + 1];
            var card3 = cList.list[i + 2];
            if (card1.value === card2.value && card2.value === card3.value) {
                i += 2;
                count++;
            }
        }
        return count;
    }
    /**
     * find the number of pair
     * @returns {number} Return the number of pair
     */
    Cards.prototype.findPairNumber = function() {
        var cList = this;
        if(!this.order || this.order === Order.NULL){
            var cList = this.clone();
            cList.sort();
        }
        var count = 0;
        for (var i = 0; i <= cList.list.length - 2; i++) {
            var card1 = cList.list[i];
            var card2 = cList.list[i + 1];
            if (card1.value == card2.value) {
                i++;
                count++;
            }
        }
        return count;
    }
    /**
     * find the number of threeBar
     * @returns {number} Return the number of threeBar
     */
    Cards.prototype.findThreeBarNumber = function() {
        this.sort();
        var count = 0;
        for (var i = 0; i <= list.size - 3; i++) {
            var card1 = list[i];
            var card2 = list[i + 1];
            var card3 = list[i + 2];
            if (card1.value == card2.value && card2.value == card3.value) {
                i += 2;
                count++;
            }
        }
        return count;
    }

    /**
     * find the number of fourBar
     * @returns {number} Return the number of fourBar
     */
    Cards.prototype.findFourBarNumber = function() {
        this.sort();
        var count = 0;
        for (var i = 0; i <= list.size - 4; i++) {
            var card1 = list[i];
            var card2 = list[i + 1];
            var card3 = list[i + 2];
            var card4 = list[i + 3];
            if (card1.value == card2.value && card2.value == card3.value && card3.value == card4.value) {
                i += 3;
                count++;
            }
        }
        return count;
    }


    /**
     * check the cards have some significance,example for entity etc.
     * @returns {boolean} true
     */
    Cards.prototype.check = function() {
        if (this.size <= 0)
            return false;
        if(!(this instanceof Cards)){
            return false;
        }
        this.sort();
        return true ;
        //
        //this.checked = true;
        //if (this.list.length <= 0){
        //    this.pokerType = PokerType.NULL;
        //    return false;
        //}
        //return true;
    }
    Cards.prototype.take = function(modelTaker){
        return modelTaker.take(this);
    }

    /**
     * 比较器，两个多张牌进行比较
     * @param cardList 多张牌
     * @returns {number} 大于1，小于-1，等于0
     */
    Cards.prototype.compareTo = function(other){
        if(!other){
            return -1;
        }
        if (!other.check() || !this.check()){
            return -1;
        }
        if (this.pokerType != other.pokerType){
            return -1;
        }
        if (this.size != other.size){
            return -1;
        }
        return 0;
    }
    Cards.prototype.toString = function() {
        var s = '{list:[';
        for(var i=0;i<this.list.length;i++){
            if(i != 0){
                s +=  ","
            }
            s +=  this.list[i].toString();
        }
        s+="],order:" + this.order +",pokerType:" +this.pokerType+ "}";
        return s;
    }
    /**
     * 是否存在某张指定的牌
     * @param value 指定的牌或牌值
     * @returns {boolean}
     */
    Cards.prototype.exists = function (value) {
        if(value instanceof Card){
            return this.list.some(function(item){
                return item.equals(value)
            })
        } else {
            return this.list.some(function(item){
                return item.value == value;
            })
        }
    }
    Cards.prototype.addList = function (cards) {
        if(!cards || !(cards instanceof Cards)){
            throw TypeError("cards is not instance of Cards")
        }
        for(var i=0;i<cards.size;i++){
            var card = cards.list[i];
            this.list.push(card);
        }
        this.checked = false;
        this.order = Order.NULL;
    }
    Cards.prototype.push = function (card) {
        if(!card){
            throw TypeError("card is undefined")
        }
        if(card instanceof Cards){
            return this.addList(card);
        }
        if(!(card instanceof Card)){
            throw TypeError("card is not instance of Card")
        }
        this.list.push(card);
        this.checked = false;
        this.order = Order.NULL;
    }
    Cards.prototype.add = Cards.prototype.push;
    Cards.prototype.pop = function () {
        this.checked = false;
        return this.list.pop();
    }
    Cards.prototype.shift = function () {
        this.checked = false;
        return this.list.shift();
    }
    Cards.prototype.unshift = function (card) {
        if(!card || !(card instanceof Card)){
            throw TypeError("card is not instance of Card")
        }
        this.checked = false;
        this.list.unshift(card);
    }
    Cards.prototype.remove = function(card) {
        if(!card || !(card instanceof Card)){
            throw TypeError("card is not instance of Card")
        }
        var self = this;
        return this.list.some(function(item,index,array){
            if(card.equals(item)) {
                self.list.splice(index,1);
                self.order = Order.NULL;
                self.checked = false;
                //var size = self.size;
                return true;
            }
            return false;
        })
    }
    Cards.prototype.removeList = function(cards) {
        if(!cards || !(cards instanceof Cards)){
            throw TypeError("cards is not instance of Cards")
        }
        for(var i=0;i<cards.size;i++){
            var c = cards.list[i];
            this.remove(c);
        }
        return this;
    }

    Cards.prototype.findByValue = function(cardValue) {
        var list = this.list.filter(function(card) {
            return card.value == cardValue;
        })
        if(list.length >= 1){
            return list[0];
        } else {
            return null;
        }
    }
    Cards.prototype.find = function(card) {
        if(!card || !(card instanceof Card)){
            throw TypeError("card is not instance of Card")
        }
        var list = this.list.filter(function(value) {
            return card.equals(value);
        })
        if(list.length >= 1){
            return list[0];
        } else {
            return null;
        }
    }
    /**
     * 是否存在传入牌值的5顺
     * @param {Number} cardValue - card's value
     * @return {Boolean} Returns 真假
     */
    Cards.prototype.existsFiveSequence = function(cardValue) {
        if (!this.list || this.list.length < 5)
            return false;

        for (var i = 0; i < 5; i++)
        {
            var cValue = cardValue + i;
            if (cValue == CardValue.Z ){
                return false;
            }
            if (!this.exists(cardValue + i)){
                return false;
            }
        }
        return true;

    }
    /**
     *  实体内部正序
     */
    Cards.prototype.entitySort = function() {
        return this.sort();
    }
    /**
     * 实体内部倒序
     */
    Cards.prototype.entityReverse = function() {
        return this.reverse();
    }

    /**
     * 排序
     * @param order 参数为正序，倒序,空
     */
    Cards.prototype.sort = function() {
        if (this.order == Order.ASC){
            return this;
        }
        this.order = Order.ASC;
        this.list.sort(function(card1,card2){
            return card1.compareTo(card2);
        });
        return this;
    }
    Cards.prototype.reverse = function() {
        if (this.order == Order.DESC){
            return this;
        }
        this.order = Order.DESC;
        this.list.sort(function(card1,card2){
            return card2.compareTo(card1);
        });
        return this;
    }
    Cards.prototype.toQuickEntity = function(EntityName) {
        if(!EntityName)
            throw TypeError('EntityName is null or undefined');
        var entity = new EntityName();
        entity.list = this.list;
        entity.order = this.order;
        entity.size = this.size;
        entity.isLast = this.isLast;
        if(entity.check()){
            return entity;
        }
        return null;
    }
    Cards.prototype.equals = function(other) {
        if (!other)
            return false;
        if (this == other)
            return true;
        if (this.size != other.size)
            return false;
        this.sort();
        other.sort();
        for (var i = 0; i < this.size; i++)
        {
            if(this.list[i].value != other.list[i].value)
                return false;
        }
        return true;
    }
    Cards.prototype.toLastEntity = function(EntityName){
        var cList = this.clone();
        cList.isLast = true;
        return cList.toCommonEntity(EntityName);
    }
    Cards.prototype.toEntity = function(EntityName){
        var cList = this.clone();
        return cList.toCommonEntity(EntityName);
    }
    Cards.prototype.toCommonEntity = function(EntityName){
        var cList = this;
        if(!!EntityName){
            return cList.toQuickEntity(EntityName)
        }
        //炸弹
        var entity =  cList.toQuickEntity(Bomb)
        if(entity != null)
            return entity;
        //单支
        var entity =  cList.toQuickEntity(Single)
        if(entity != null)
            return entity;
        //对子
        var entity =  cList.toQuickEntity(Pair)
        if(entity != null)
            return entity;

        //三带二
        var entity =  cList.toQuickEntity(ThreeBarWithTwo)
        if(entity != null)
            return entity;
        //单顺
        var entity =  cList.toQuickEntity(SingleSequence)
        if(entity != null)
            return entity;
        //双顺
        var entity =  cList.toQuickEntity(PairSequence)
        if(entity != null)
            return entity;

        //飞机带翅膀
        var entity =  cList.toQuickEntity(ThreeSequenceWithWing)
        if(entity != null)
            return entity;

        var entity =  cList.toQuickEntity(BombWithThreeSingle)
        if(entity != null)
            return entity;

        return null;
    }




    //***********************实体开始*******************************

    /**
     * 炸弹：相同点数的四张牌在一起的牌型，比如四条A。除火箭外，它可以打任何牌型，炸弹对炸弹时，要比大小。
     * @extends Cards
     * @constructor
     */
    var Bomb = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.BOMB;
    }
    inherits(Bomb,Cards);
    Bomb.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.list.length != 4 || !this.existsFourBar()){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.pokerType = PokerType.BOMB;
        return true;
    }
    Bomb.prototype.compareTo = function(other) {
        if (!other)
            return -1;
        other.sort();
        if (!other.check() || !this.check()){
            return -1;
        }
        if (other.pokerType == PokerType.ROCKET){
            return -1;
        }
        if (other.pokerType == PokerType.BOMB){
            return this.list[0].compareTo(other.list[0]);
        }
        return 1;
    }



    /**
     * 对子（一手牌）：相同点数的两张牌在一起的牌型，比如55。
     * @extends Cards
     * @constructor
     */
    var Pair = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.PAIR;
    }
    inherits(Pair,Cards);
    Pair.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.size != 2 || !this.existsPair()){
            this.pokerType = PokerType.NULL;
            return false;
        }
        if (this.list[0].value < 3 || this.list[0].value > 15){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.pokerType = PokerType.PAIR;
        return true;
    }
    Pair.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        return this.list[0].compareTo(other.list[0]);
    }

    /**
     * 双顺：三对或更多的连续对子组成的牌型，比如334455或445566778899。2和大小王不可以连。
     * @extends Cards
     * @constructor
     */
    var PairSequence = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.PAIR_SEQUENCE;
    }
    inherits(PairSequence,Cards);
    PairSequence.prototype.entitySort = function() {
        return this.sort();
    }
    PairSequence.prototype.entityReverse = function() {
        return this.reverse();
    }
    PairSequence.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.size < 4)
            return false;
        if (this.size % 2 != 0)
            return false;
        if (this.exists(CardValue.Z))
            return false;
        var pairTaker = new PairTaker();
        var pairModel = this.take(pairTaker);

        if (!pairModel || pairModel.size < 2 || pairModel.size != this.size / 2)
            return false;
        pairModel.sort();
        var minCardValue = pairModel.list[0].list[0].value
        if (minCardValue < 3 || minCardValue > 13){
            this.pokerType = PokerType.NULL;
            return false;
        }
        var maxCardValue = pairModel.list[pairModel.size-1].list[0].value
        if (maxCardValue < 4 || maxCardValue > 14){
            this.pokerType = PokerType.NULL;
            return false;
        }
        var cards = new Cards();
        for(var i=0;i<pairModel.size;i++){
            var cList = pairModel.list[i];
            cards.add(cList.list[0]);
        }
        if (!cards.isSequence())
            return false;

        return true;
    }
    PairSequence.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        return this.list[0].compareTo(other.list[0]);
    }
    PairSequence.prototype.toSingleSequenceModel = function() {
        if (this.size < 5)
            return null;
        this.sort();
        var singleSequenceModel = new SingleSequenceModel();
        var singleSequence1 = new SingleSequence();
        var singleSequence2 = new SingleSequence();
        for (var i = 0; i < this.size; i++) {
            if (i % 2 == 0)
                singleSequence1.add(this[i]);
            else
                singleSequence2.add(this[i]);
        }
        singleSequenceModel.add(singleSequence1);
        singleSequenceModel.add(singleSequence2);
        return singleSequenceModel;
    }


    /**
     * 单支（一手牌）：单张牌，如一支3。
     * @extends Cards
     * @constructor
     */
    var Single = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.SINGLE;
    }
    inherits(Single,Cards);
    Single.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.size != 1)
            return false;
        if(this.list[0].value < 3 || this.list[0].value > 17){
            return false;
        }
        return true;
    }
    Single.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        return this.list[0].compareTo(other.list[0]);
    }


    /**
     * 单顺：五张或更多的连续单支牌组成的牌型，比如45678或345678910JQKA。2和大小王不可以连。
     * @extends Cards
     * @constructor
     */
    var SingleSequence = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.SINGLE_SEQUENCE;
    }
    inherits(SingleSequence,Cards);
    SingleSequence.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.size < 5)
            return false;
        if (this.exists(CardValue.Z))
            return false;
        if (!this.isSequence())
            return false;
        this.sort();
        var minCardValue = this.list[0].value;
        if(minCardValue < 3 || minCardValue > 10){
            return false;
        }
        var maxCardValue = this.list[this.size - 1].value;
        if(maxCardValue < 7 || maxCardValue > 14){
            return false;
        }
        return true;
    }
    SingleSequence.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        if(this.size != other.size){
            return -1;
        }
        return this.list[0].compareTo(other.list[0]);
    }
    SingleSequence.prototype.takeSingleSequence = function(position,count) {
        if (count > this.size || position > this.size - count || position < 0 || count < 5)
            return null;
        var singleSequence = new SingleSequence();
        for (var i = position; i < position + count; i++) {
            singleSequence.add(this.list[i]);
        }
        if (singleSequence.check())
            return singleSequence;
        return null;
    }
    /**
     * 提取比传入的单顺更大的单顺
     * @param singleSequence
     * @returns {*}
     */
    SingleSequence.prototype.takeBigger = function(singleSequence) {
        var count = singleSequence.size;
        for (var i = 0; i <= this.size - count; i++) {
            var position = i;
            var newSingleSequence = this.takeSingleSequence(position, count);
            if (!!newSingleSequence && newSingleSequence.compareTo(singleSequence) > 0) {
                return newSingleSequence;
            }
        }
        return null;
    }
    /**
     * 提取比传入的单顺更大的单顺
     * @param singleSequence
     * @returns {*}
     */
    SingleSequence.prototype.takeBiggerList = function(singleSequence) {
        var count = singleSequence.size;
        var list = [];
        for (var i = 0; i <= this.size - count; i++) {
            var position = i;
            var newSingleSequence = this.takeSingleSequence(position, count);
            if (!!newSingleSequence && newSingleSequence.compareTo(singleSequence) > 0) {
                list.push(newSingleSequence);
            }
        }
        return list;
    }

    /**
     * 三条：相同点数的三张牌在一起的牌型，比如三条4。
     * @extends Cards
     * @constructor
     */
    var ThreeBar = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.THREE_BAR;
    }
    inherits(ThreeBar,Cards);
    ThreeBar.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.size != 3 || !this.existsThreeBar())
            return false;
        if (this.list[0].value < 3 || this.list[0].value > 15){
            this.pokerType = PokerType.NULL;
            return false;
        }
        return true;
    }
    ThreeBar.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        return this.list[0].compareTo(other.list[0]);
    }


    /**
     * 三带二：三条 ＋ 一对或两张，比如AAA+34。
     * @extends Cards
     * @constructor
     */
    var ThreeBarWithTwo = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.THREE_BAR_WITH_TWO;
    }

    inherits(ThreeBarWithTwo,Cards);
    ThreeBarWithTwo.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if(!this.existsThreeBar() || this.size > 5){
            return false;
        }
        if(!this.isLast && this.size != 5){
            return false;
        }

        return true;
    }
    ThreeBarWithTwo.prototype.compareTo = function(other) {
        if(!other){
            return -1;
        }
        if (!other.check() || !this.check()){
            return -1;
        }
        if (this.pokerType != other.pokerType){
            return -1;
        }
        //
        //
        // var i = Cards.prototype.compareTo.call(this,other);
        // if (i != 0){
        //     return i;
        // }
        var threeBarTaker = new ThreeBarTaker();
        var thisModel = this.take(threeBarTaker);
        if(!thisModel || thisModel.size <= 0){
            return -1;
        }
        var otherModel = other.take(threeBarTaker);
        if(!otherModel || otherModel.size <= 0){
            return -1;
        }
        return thisModel.list[0].compareTo(otherModel.list[0]);
    }
    ThreeBarWithTwo.prototype.entitySort = function() {
        var threeBarModel = this.take(new ThreeBarTaker());
        if(!threeBarModel || threeBarModel.size <= 0){
            return this;
        }
        this.removeList(threeBarModel.list[0]);
        this.list.unshift.apply(this.list,threeBarModel.list[0].list);
        return this;
    }
    ThreeBarWithTwo.prototype.entityReverse = function() {
        return this.entitySort();
    }



    /**
     * 三顺：二个或更多的连续三条组成的牌型，比如777888或444555666777。2和大小王不可以连。
     * @extends Cards
     * @constructor
     */
    var ThreeSequence = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.THREE_SEQUENCE;
    }
    inherits(ThreeSequence,Cards);
    ThreeSequence.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.size < 6)
            return false;
        if (this.size % 3 != 0)
            return false;
        if (this.exists(CardValue.Z))
            return false;
        var threeBarTaker = new ThreeBarTaker();
        var threeBarModel = this.take(threeBarTaker);
        if (!threeBarModel || threeBarModel.size < 2 || threeBarModel.size * 3 != this.size)
            return false;

        threeBarModel.sort();
        var minCardValue = threeBarModel.list[0].list[0].value
        if (minCardValue < 3 || minCardValue > 13){
            this.pokerType = PokerType.NULL;
            return false;
        }
        var maxCardValue = threeBarModel.list[threeBarModel.size-1].list[0].value
        if (maxCardValue < 4 || maxCardValue > 14){
            this.pokerType = PokerType.NULL;
            return false;
        }

        var cards = new Cards();
        for(var i =0;i<threeBarModel.size;i++){
            var threeBar = threeBarModel.list[i];
            cards.add(threeBar.list[0]);
        }
        if (!cards.isSequence())
            return false;
        return true;
    }
    ThreeSequence.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        return this.list[0].compareTo(other.list[0]);
    }
    ThreeSequence.prototype.entitySort = function() {
        return this.sort();
    }
    ThreeSequence.prototype.entityReverse = function() {
        return this.reverse();
    }




    /**
     * 飞机带翅膀：三顺 ＋ 同数量的单张牌，比如777888+3+6。
     * 77788889,5556667778889999
     * @extends Cards
     * @constructor
     */
    var ThreeSequenceWithWing = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.THREE_SEQUENCE_WITH_WING;
    }
    inherits(ThreeSequenceWithWing,Cards);
    ThreeSequenceWithWing.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.size < 10)
            return false;
        var cardList = this.clone();
        var threeSequenceTaker = new ThreeSequenceTaker();
        var threeSequenceModel = cardList.take(threeSequenceTaker);

        if (!threeSequenceModel || threeSequenceModel.size < 1)
            return false;
        if(threeSequenceModel.size == 2){
            if(threeSequenceModel.list[0].size == 9 && threeSequenceModel.list[1].size == 6){
                return true;
            } else if(threeSequenceModel.list[1].size == 9 && threeSequenceModel.list[0].size == 6){
                return true;
            } else {
                return false;
            }
        }
        var threeSequence = threeSequenceModel.list[0];
        cardList.removeList(threeSequence);
        if (cardList.size == (threeSequence.size / 3)*2)
            return true;
        if(threeSequence.size >= 12){//三顺带三顺333444555666777
            return true;
        }
        if(threeSequence.size == 9 && cardList.size == 1){//三顺带三顺9555666777?
            return true;
        }
        return false;
    }
    ThreeSequenceWithWing.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        var threeSequenceTaker = new ThreeSequenceTaker();
        var thisModel = this.take(threeSequenceTaker);
        if(!thisModel || thisModel.size <= 0){
            return -1;
        }
        var otherModel = other.take(threeSequenceTaker);
        if(!otherModel || otherModel.size <= 0){
            return -1;
        }
        return thisModel.list[0].compareTo(otherModel.list[0]);
    }
    ThreeSequenceWithWing.prototype.entitySort = function() {
        var threeBarModel = this.take(new ThreeBarTaker());
        if(!threeBarModel || threeBarModel.size <= 0){
            return this;
        }
        threeBarModel.sort();
        var cList = threeBarModel.toCardList();
        this.sort().removeList(cList);
        this.list.unshift.apply(this.list,cList.list);
        return this;
    }
    ThreeSequenceWithWing.prototype.entityReverse = function() {
        var threeBarModel = this.take(new ThreeBarTaker());
        if(!threeBarModel || threeBarModel.size <= 0){
            return this;
        }
        threeBarModel.reverse();
        var cList = threeBarModel.toCardList();
        this.reverse().removeList(cList);
        this.list.unshift.apply(this.list,cList.list);
        return this;
    }

    /**
     * 四带三：四条+三牌(单张)。比如AAAA+7+9+8。
     * @extends Cards
     * @constructor
     */
    var BombWithThreeSingle = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.BOMB_WITH_THREE_SINGLE;
    }
    inherits(BombWithThreeSingle,Cards);
    BombWithThreeSingle.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.size > 7 || !this.existsFourBar())
            return false;
        if(!this.isLast && this.size != 7){
            return false;
        }
        return true;
    }
    BombWithThreeSingle.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        var bombTaker = new BombTaker();
        var thisModel = this.take(bombTaker);
        if(!thisModel || thisModel.size < 1){
            return -1;
        }
        var otherModel = other.take(bombTaker);
        if(!otherModel || otherModel.size < 1){
            return -1;
        }
        thisModel.reverse();
        otherModel.reverse();
        return thisModel.list[0].compareTo(otherModel.list[0]);
    }
    BombWithThreeSingle.prototype.entityReverse = function() {
        var bombModel = this.take(new BombTaker());
        if(!bombModel || bombModel.size <= 0){
            return this;
        }
        this.reverse().removeList(bombModel.list[0]);
        this.list.unshift.apply(this.list,bombModel.list[0].list);
        return this;
    }
    BombWithThreeSingle.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i != 0){
            return i;
        }
        var bombTaker = new BombTaker();
        var thisModel = this.take(bombTaker);
        if(!thisModel || thisModel.size < 1){
            return -1;
        }
        var otherModel = other.take(bombTaker);
        if(!otherModel || otherModel.size < 1){
            return -1;
        }
        thisModel.reverse();
        otherModel.reverse();
        return thisModel.list[0].compareTo(otherModel.list[0]);
    }

    //***********************实体结束*******************************

    //***********************模型对象开始******************************

    /**
     * 组合：多个牌列表组合成一个组合器
     * @constructor
     */
    var ModelBase = function(list){
        this.list = list || [];
        this.order = Order.NULL;
        var self = this;
        Object.defineProperty(this, "size", {
            get: function () {
                return self.list.length;
            }
        });
    }
    ModelBase.prototype.takeBigger = function (entity) {
        return this.list.filter(function (item) {
            return item.compareTo(entity) > 0;
        })
    }
    /**
     * 从此模型中删除与此牌列表一样的一项
     * @param {entity} cardList entity is sub class of cards
     */
    ModelBase.prototype.remove = function(cardList){
        if(!cardList || !(cardList instanceof Cards)){
            throw TypeError("cardList is not instance of Cards")
        }
        var self = this;
        return this.list.some(function(item,index,array){
            if(cardList.equals(item)) {
                self.list.splice(index,1);
                self.order = Order.NULL;
                return true;
            }
            return false;
        });
    }
    ModelBase.prototype.toCardList = function(){
        var newCardList = new Cards();
        for(var i=0;i<this.size;i++){
            var cardList = this.list[i];
            newCardList.addList(cardList);
        }
        if (newCardList.size > 0){
            return newCardList;
        }
        return null;
    }
    /**
     * is remain one hand
     * @returns {boolean} <i>true</i> if is remain on hand, otherwise <i>false</i>
     */
    ModelBase.prototype.isOneHand = function(){
        var cardList = this.toCardList();//一手牌
        if (!cardList)
            return false;
        var oneHand = cardList.toEntity();
        if (oneHand != null)
            return true;
        return false;
    }
    ModelBase.prototype.push = function (cards) {
        if(!cards){
            throw TypeError("cards is undefined")
        }

        if(!(cards instanceof Cards)){
            throw TypeError("cards is not instance of Cards")
        }
        this.list.push(cards);
        this.order = Order.NULL;
    }
    ModelBase.prototype.clone = function(){
        var other = Object.create(this);
        other.list = [];
        // for(var i in this.list) {
        //     other.push(this.list[i]);
        // }
        for(var i=0;i<this.list.length;i++){
            other.push(this.list[i]);
        }

        other.order = this.order;
        Object.defineProperty(other, "size", {
            get: function () {
                return other.list.length;
            }
        });
        return other;
    }

    ModelBase.prototype.reverse = function(){
        this.list.sort(function(entity1,entity2){
            return entity2.compareTo(entity1);
        });
        this.order = Order.NULL;
        return this;
    }

    ModelBase.prototype.sort = function(){
        this.list.sort(function(entity1,entity2){
            return entity1.compareTo(entity2);
        });
        this.order = Order.NULL;
        return this;
    }
    /**
     * 将某实体加入此模型
     * @param {entity} cardList entity is sub class of cards
     */
    ModelBase.prototype.add = function(cardList){
        if (!cardList)
            return;
        var some = this.list.some(function(item){
            return item === cardList;
        });
        if(!!some){
            return;
        }
        this.list.push(cardList);
        this.order = Order.NULL;
    }

    /**
     * 向此模型中增加新模型
     * @param {Model} model
     */
    ModelBase.prototype.addModel = function(model){
        if (!model)
            return;
        for(var i=0;i<model.size;i++){
            var cardList = model.list[i];
            this.add(cardList);
        }
        this.order = Order.NULL;
    }
    ModelBase.prototype.findNumber = function(pokerType){
        var number = 0;
        for(var i=0;i<this.size;i++){
            var cardList = this.list[i];
            if (cardList.pokerType == pokerType){
                number++;
            }
        }
        return number;
    }
    ModelBase.prototype.toString = function(){
        var myString = "[";
        for(var i=0;i<this.size;i++){
            var cardList = this.list[i];
            myString += "\r\n" + cardList.toString();
        }
        myString += "]";
        return myString;
    }
    /**
     * 此模型的最小T实体
     * @returns {*}
     */
    ModelBase.prototype.min = function(){
        if (this.list != null && this.size > 0)
        {
            var model = this.findAll();
            if (!model || model.size <= 0 )
                return null;
            model.sort();
            return model.list[0];
        }
        return null;
    }
    /**
     * 此模型的最大T实体
     * @returns {*}
     */
    ModelBase.prototype.max = function(){
        if (this.list != null && this.size > 0)
        {
            var model = this.findAll();
            if (!model || model.size <= 0 )
                return null;
            model.sort();
            return model.list[this.size - 1];
        }
        return null;

    }
    ModelBase.prototype.clear = function(){
        this.list = [];
        this.order = Order.NULL;
    }
    ModelBase.prototype.filter = function(match){
        var model = this.clone();
        model.list = this.list.filter(match);
        return model;
    }


    /**
     * 炸弹列表
     * @constructor
     */
    var BombModel = function(){
        this.pokerType = PokerType.BOMB;
        ModelBase.call(this);
    }
    inherits(BombModel,ModelBase);

    /**
     * 对子列表：列表中所有项都是对子
     * @constructor
     */
    var PairModel = function(){
        this.pokerType = PokerType.PAIR;
        ModelBase.call(this);
    }
    inherits(PairModel,ModelBase);

    /**
     * 转成对顺模型
     * @returns {PairSequenceModel|*} Returns 对顺或Null
     */
    PairModel.prototype.toPairSequence = function(){
        var pairSequenceModel = new PairSequenceModel();
        for(var i=0;i<this.size;i++){
            var pair = this.list[i];
            pairSequenceModel.append(pair);
        }
        var model = pairSequenceModel.clone();
        for(var j=0;j<model.size;j++){
            var pairSequence = model.list[j];
            if (pairSequence.size < 4)
                pairSequenceModel.remove(pairSequence);
        }
        return pairSequenceModel;



    }

    /**
     * 对顺列表
     * @constructor
     */
    var PairSequenceModel = function(){
        this.pokerType = PokerType.PAIR_SEQUENCE;
        ModelBase.call(this);
    }
    inherits(PairSequenceModel,ModelBase);
    PairSequenceModel.prototype.append = function (pair){
        var appendSucess = false;
        for(var i=0;i<this.size;i++){
            var pairSequence = this.list[i];
            var cardValue = pairSequence.list[pairSequence.size -1].value + 1;
            if (pair.list[0].value == cardValue && pair.list[0].value != CardValue.Z)
            {
                pairSequence.add(pair);
                appendSucess = true;
                break;
            }
        }
        if (!appendSucess)
        {
            var pairSequence = new PairSequence();
            pairSequence.add(pair);
            this.add(pairSequence);
        }
    }
    /**
     * 火箭
     * @constructor
     */
    var RocketModel = function(){
        this.pokerType = PokerType.ROCKET;
        ModelBase.call(this);
    }
    inherits(RocketModel,ModelBase);

    /**
     * 单张列表：列表中所有项都是单张
     * @constructor
     */
    var SingleModel = function(list){
        this.pokerType = PokerType.SINGLE;
        ModelBase.call(this,list);
    }
    inherits(SingleModel,ModelBase);

    /**
     * 单顺列表
     * @constructor
     */
    var SingleSequenceModel = function(){
        this.pokerType = PokerType.SINGLE_SEQUENCE;
        ModelBase.call(this);
    }
    inherits(SingleSequenceModel,ModelBase);
    /**
     * 合并单顺
     */
    SingleSequenceModel.prototype.combine = function(){
        var newModel = new SingleSequenceModel();
        while (this.size > 1)
        {
            var singleSequence1 = this.list[0];
            var cardValue = singleSequence1.list[singleSequence1.size - 1].value;
            var nextCardValue = cardValue + 1;
            var singleSequenceModel = this.filter(function(item){
                return item.list[0].value == nextCardValue;
            })

            if (singleSequenceModel != null && singleSequenceModel.size > 0)
            {
                var newSingleSequence = new SingleSequence();
                var singleSequence2 = singleSequenceModel.list[0];
                this.remove(singleSequence1);
                this.remove(singleSequence2);
                newSingleSequence.addList(singleSequence1);
                newSingleSequence.addList(singleSequence2);
                this.add(newSingleSequence);
                continue;
            }
            break;
        }
        // for(var j=0;j<newModel.size;j++){
        //     var singleSequence = newModel.list[j];
        //     this.add(singleSequence);
        // }
    }


    /**
     * 三条列表：列表中所有项都是三条
     * @constructor
     */
    var ThreeBarModel = function(){
        this.pokerType = PokerType.THREE_BAR;
        ModelBase.call(this);
    }
    inherits(ThreeBarModel,ModelBase);

    /**
     * 转成三顺模型
     */
    ThreeBarModel.prototype.toThreeSequence = function() {
        var threeSequenceModel = new ThreeSequenceModel();
        for(var i=0;i<this.size;i++){
            var threeBar = this.list[i];
            threeSequenceModel.append(threeBar);
        }
        var model = threeSequenceModel.clone();
        for(var j=0;j<model.size;j++){
            var threeSequence = model.list[j];
            if (threeSequence.size < 6)
                threeSequenceModel.remove(threeSequence);
        }
        return threeSequenceModel;

    }


    /**
     * 三顺列表
     * @constructor
     */
    var ThreeSequenceModel = function(){
        this.pokerType = PokerType.THREE_SEQUENCE;
        ModelBase.call(this);
    }
    inherits(ThreeSequenceModel,ModelBase);

    ThreeSequenceModel.prototype.takeBigger = function(threeSequence) {
        var threeSequenceList = [];
        this.list.forEach(function(sequence){
            if(sequence.compareTo(threeSequence) > 0){
                threeSequenceList.push(sequence);
            }
        });
        return threeSequenceList;

    }
    ThreeSequenceModel.prototype.append = function(threeBar) {
        var appendSucess = false;
        for(var i=0;i<this.size;i++){
            var threeSequence = this.list[i];
            threeSequence.add(threeBar);
            if (!threeSequence.check())
                threeSequence.removeList(threeBar);
            else
            {
                appendSucess = true;
                break;
            }
        }
        if (!appendSucess)
        {
            var threeSequence = new ThreeSequence();
            threeSequence.add(threeBar);
            this.add(threeSequence);
        }
    }

    /**
     * 组合模型
     * @constructor
     */
    var CompositeModel = function(){
        ModelBase.call(this);
    }
    inherits(CompositeModel,ModelBase);
    CompositeModel.prototype.toCardList = function () {
        var cards = new Cards();
        this.list.forEach(function (model) {
            model.list.forEach(function (entity) {
                cards.addList(entity);
            })
        });
        return cards;
    }
    CompositeModel.prototype.sort = function(){
        this.list.sort(function (m1,m2) {
            return m1.list[0].pokerType - m2.list[0].pokerType;
        });
        return this;
    }
    CompositeModel.prototype.findModel = function(pokerType,match){
        var modelList = this.list.filter(function (item) {
            return item.pokerType == pokerType;
        });
        if(!!modelList && modelList.length > 0){
            if(!!match){
                var newModel = modelList[0].clone();
                newModel.list = modelList[0].list.filter(match);
                return newModel;
            }
            return modelList[0];
        }
        return null;
    }

    //***********************模型对象结束******************************

    //***********************提取器开始******************************
    /**
     * 炸弹提取器
     * @constructor
     */
    var BombTaker = function() {
    }
    /**
     * 从多张牌中提取模型
     */
    BombTaker.prototype.take = function(cardList) {
        if(!cardList || cardList.size < 4){
            return null;
        }
        cardList.sort();
        var bombList = new BombModel();
        for (var i = 0; i <= cardList.size - 4; i++)
        {
            var card1 = cardList.list[i];
            var card2 = cardList.list[i + 1];
            var card3 = cardList.list[i + 2];
            var card4 = cardList.list[i + 3];
            if (card1.value == card2.value && card2.value == card3.value && card3.value == card4.value) {
                var bomb = new Bomb();
                bomb.add(card1);
                bomb.add(card2);
                bomb.add(card3);
                bomb.add(card4);
                bombList.add(bomb);
                i += 3;
            }
        }
        if (bombList!= null && bombList.size > 0)
            return bombList;
        return null;
    }




    /**
     * 单顺5张牌提取器
     * @constructor
     */
    var FiveSingleSequenceTaker = function() {
    }

    var findFiveSequenceByValue = function(cardList,cardValue)
    {
        if (!cardList.existsFiveSequence(cardValue)){
            return null;
        }
        var singleSequence = new SingleSequence();

        for (var i = 0; i < 5; i++)
        {
            var iCardValue = cardValue + i;
            var card = cardList.findByValue(iCardValue);
            singleSequence.add(card);
        }
        return singleSequence;
    }
    var findFiveSequence = function(cardList)
    {
        if (!cardList || cardList.size < 5)
            return null;
        cardList.sort();
        for(var i=0;i<cardList.size;i++){
            var card = cardList.list[i];
            var singleSequence = findFiveSequenceByValue(cardList, card.value);
            if (singleSequence != null && singleSequence.size > 0)
                return singleSequence;
        }
        return null;
    }
    var fillFiveSequence = function(singleSequenceList, cardList)
    {
        var singleSequence = findFiveSequence(cardList);
        if (!singleSequence)
            return;
        singleSequenceList.add(singleSequence);
        var cardListClone = cardList.clone();
        cardListClone.removeList(singleSequence);
        fillFiveSequence(singleSequenceList, cardListClone);
    }


    FiveSingleSequenceTaker.prototype.take = function(cardList) {
        if (!cardList || cardList.size < 5)
            return null;
        cardList.sort();
        var singleSequenceModel = new SingleSequenceModel();
        fillFiveSequence(singleSequenceModel, cardList);
        if (singleSequenceModel!=null && singleSequenceModel.size > 0)
            return singleSequenceModel;
        return null;
    }




    /**
     * 对子提取器
     * @constructor
     */
    var PairTaker = function() {
    }
    PairTaker.prototype.take = function(cardList) {
        if(!cardList || cardList.size < 2){
            return null;
        }
        cardList.sort();
        var pairList = new PairModel();
        for (var i = 0; i <= cardList.size - 2; i++) {
            var card1 = cardList.list[i];
            var card2 = cardList.list[i + 1];
            if (card1.value == card2.value) {
                var pair = new Pair();
                pair.add(card1);
                pair.add(card2);
                pairList.add(pair);
                i++;
            }
        }
        if (!!pairList && pairList.size > 0)
            return pairList;
        return null;
    }





    /**
     * 对顺提取器
     * @constructor
     */
    var PairSequenceTaker = function() {
    }
    PairSequenceTaker.prototype.take = function(cardList) {
        if (!cardList || cardList.size < 4)
            return null;
        var pairTaker = new PairTaker()
        var pairList = cardList.take(pairTaker);
        if (pairList==null || pairList.size < 2)
            return null;
        var pairSequenceModel = pairList.toPairSequence();

        if (pairSequenceModel!=null && pairSequenceModel.size > 0)
            return pairSequenceModel;
        return null;
    }










    /**
     * 单张提取器:从牌列表中提取所有单张进行组合
     * @constructor
     */
    var SingleTaker = function(){
    }
    SingleTaker.prototype.take = function(cardList){
        if (!cardList || cardList.size < 1)
            return null;
        cardList.sort();
        var singleList = new SingleModel();
        for(var i=0;i<cardList.size;i++){
            var card = cardList.list[i];
            var single = new Single();
            single.add(card);
            singleList.add(single);
        }
        if (singleList!=null && singleList.size > 0)
            return singleList;
        return null;

    }


    /**
     * 普通单顺模型提取器
     * @constructor
     */
    var NormalSequenceTaker = function(){
    }

    NormalSequenceTaker.prototype.take = function(cardList){
        if (!cardList || cardList.size < 5)
            return null;
        var cList = new Cards();
        cardList.list.forEach(function(card){
            if(!cList.exists(card.value)){
                cList.add(card);
            }
        });

        var singleSequenceTaker = new SingleSequenceTaker();
        return cList.take(singleSequenceTaker);
    }


    /**
     * 单顺模型提取器
     * @constructor
     */
    var SingleSequenceTaker = function(){
    }
    var addCardListToSequenceList = function(singleSequenceList, cardList){
        var newFiveCardList = cardList.clone();
        for(var i=0;i<newFiveCardList.size;i++){
            var card = newFiveCardList.list[i];
            for (var j = 0; j < singleSequenceList.size; j++)
            {
                var fiveCardList = singleSequenceList.list[j].clone();
                fiveCardList.add(card);
                //判断是否是顺子
                if (fiveCardList.isSequence())
                {
                    cardList.remove(card);
                    singleSequenceList.list[j].add(card);
                    break;
                }
            }
        }
    }
    SingleSequenceTaker.prototype.take = function(cardList){
        if (!cardList || cardList.size < 5)
            return null;
        //选取五连，先取出最小的一个五连，再在剩余的牌中取出最小的一个五连，依此类推，直到没有五连为止。
        var fiveSingleSequenceTaker = new FiveSingleSequenceTaker();
        var singleSequenceList = cardList.take(fiveSingleSequenceTaker);
        if (!singleSequenceList || singleSequenceList.size <= 0)
            return null;
        //b) 扩展五连，将剩余的牌与已经取出的牌进行比对，如果某张剩余的牌与已知的连牌能组成更大的连牌，则将其合并。一直到无法合并为止。
        var cardListClone = cardList.clone();
        cardListClone.removeList(singleSequenceList.toCardList());
        addCardListToSequenceList(singleSequenceList, cardListClone);
        //
        //c) 合并连牌，如果某两组连牌能无缝连接成更大的连牌，则将其合并成一组。
        singleSequenceList.combine();

        if (singleSequenceList!= null && singleSequenceList.size > 0)
            return singleSequenceList;
        return null;
    }






    /**
     * 三条提取器
     * @constructor
     */
    var ThreeBarTaker = function(){
    }
    ThreeBarTaker.prototype.take = function(cardList){
        if (!cardList || cardList.size < 3)
            return null;
        cardList.sort();
        var threeBarList = new ThreeBarModel();
        for (var i = 0; i <= cardList.size - 3; i++) {
            var card1 = cardList.list[i];
            var card2 = cardList.list[i + 1];
            var card3 = cardList.list[i + 2];
            if (card1.value == card2.value && card2.value == card3.value)  {
                var threeBar = new ThreeBar();
                threeBar.add(card1);
                threeBar.add(card2);
                threeBar.add(card3);

                threeBarList.add(threeBar);
                i += 2;
            }
        }
        if (threeBarList!=null && threeBarList.size > 0)
            return threeBarList;
        return null;
    }




    /**
     * 三顺提取器
     * @constructor
     */
    var ThreeSequenceTaker = function(){
    }
    ThreeSequenceTaker.prototype.take = function(cardList){
        if (!cardList || cardList.size < 6)
            return null;
        var threeSequenceList = new ThreeSequenceModel();
        var threeBarTaker = new ThreeBarTaker();
        var threeBarList = cardList.take(threeBarTaker);

        if (!threeBarList || threeBarList.size < 2)
            return null;
        var threeSequenceModel = threeBarList.toThreeSequence();

        if (threeSequenceModel!=null && threeSequenceModel.size > 0)
            return threeSequenceModel;
        return null;

    }

    /**
     * 组合模型提取器
     */
    var CompositeTaker = function (pokerType) {
        this.list = [];
        switch (pokerType){
            case PokerType.PAIR:
                this.initialPair();
                break;
            case PokerType.THREE_BAR:
                this.initialThreeBar();
                break;
            case PokerType.PAIR_SEQUENCE:
                this.initialPairSequence();
                break;
            case PokerType.SINGLE_SEQUENCE:
                this.initialSingleSequence();
                break;
            case PokerType.THREE_SEQUENCE:
                this.initialThreeSequence();
                break;
            default:
                this.initialThreeBar();
                break;
        }
    }
    CompositeTaker.prototype.initialPair = function () {

        //提取炸弹
        this.list.push(new BombTaker());
        //提取对子
        this.list.push(new PairTaker());
        //提取全部三顺
        this.list.push(new ThreeSequenceTaker());
        //提取单顺
        this.list.push(new SingleSequenceTaker());
        //提取三条
        this.list.push(new ThreeBarTaker());
        //提取双顺
        this.list.push(new PairSequenceTaker());
        //提取单张
        this.list.push(new SingleTaker());
    }
    CompositeTaker.prototype.initialThreeSequence = function () {

        //提取炸弹
        this.list.push(new BombTaker());
        //提取全部三顺
        this.list.push(new ThreeSequenceTaker());
        //提取单顺
        this.list.push(new SingleSequenceTaker());
        //提取三条
        this.list.push(new ThreeBarTaker());
        //提取双顺
        this.list.push(new PairSequenceTaker());
        //提取对子
        this.list.push(new PairTaker());
        //提取单张
        this.list.push(new SingleTaker());
    }
    CompositeTaker.prototype.initialPairSequence = function () {

        //提取炸弹
        this.list.push(new BombTaker());
        //提取双顺
        this.list.push(new PairSequenceTaker());
        //提取全部三顺
        this.list.push(new ThreeSequenceTaker());

        //提取单顺
        this.list.push(new SingleSequenceTaker());
        //提取三条
        this.list.push(new ThreeBarTaker());
        //提取对子
        this.list.push(new PairTaker());
        //提取单张
        this.list.push(new SingleTaker());
    }
    CompositeTaker.prototype.initialThreeBar = function () {

        //提取炸弹
        this.list.push(new BombTaker());
        //提取全部三顺
        this.list.push(new ThreeSequenceTaker());
        //提取三条
        this.list.push(new ThreeBarTaker());
        //提取单顺
        this.list.push(new SingleSequenceTaker());
        //提取双顺
        this.list.push(new PairSequenceTaker());
        //提取对子
        this.list.push(new PairTaker());
        //提取单张
        this.list.push(new SingleTaker());
    }
    CompositeTaker.prototype.initialSingleSequence = function () {
        //提取炸弹
        this.list.push(new BombTaker());
        //提取单顺
        this.list.push(new SingleSequenceTaker());
        //提取全部三顺
        this.list.push(new ThreeSequenceTaker());
        //提取三条
        this.list.push(new ThreeBarTaker());
        //提取双顺
        this.list.push(new PairSequenceTaker());
        //提取对子
        this.list.push(new PairTaker());
        //提取单张
        this.list.push(new SingleTaker());
    }
    /**
     * 从多张牌中提取模型
     * @param cardList
     */
    CompositeTaker.prototype.take = function (cardList) {
        if (!cardList || cardList.size <= 0)
            return null;
        var model = new CompositeModel();
        var cloneCardList = cardList.clone();
        for(var i=0;i<this.list.length;i++){
            var taker = this.list[i];
            var itemList = taker.take(cloneCardList);
            if (!!itemList  && itemList.size > 0) {
                cloneCardList.removeList(itemList.toCardList());
                model.add(itemList);
            }
        }
        var singleSequenceModel = model.list.filter(function (item) {
            return item.pokerType == PokerType.SINGLE_SEQUENCE;
        })
        if (singleSequenceModel != null && singleSequenceModel.size > 1)  {
            if (singleSequenceModel.size == 2 && singleSequenceModel.list[0].equals(singleSequenceModel.list[1]))  {
                var singleSequence1 = singleSequenceModel.list[0];
                var singleSequence2 = singleSequenceModel.list[1];
                model.remove(singleSequence1);
                model.remove(singleSequence2);
                var pairSequence = new PairSequence();
                pairSequence.addList(singleSequence1);
                pairSequence.addList(singleSequence2);
                pairSequence.sort();
                model.add(pairSequence);
            } else if (singleSequenceModel.size == 3 && singleSequenceModel.list[0].equals(singleSequenceModel.list[1]) && singleSequenceModel.list[1].equals(singleSequenceModel.list[2])) {
                var singleSequence1 = singleSequenceModel.list[0];
                var singleSequence2 = singleSequenceModel.list[1];
                var singleSequence3 = singleSequenceModel.list[2];
                model.remove(singleSequence1);
                model.remove(singleSequence2);
                model.remove(singleSequence3);
                var threeSequence = new ThreeSequence();
                threeSequence.addList(singleSequence1);
                threeSequence.addList(singleSequence2);
                threeSequence.addList(singleSequence3);
                threeSequence.sort();
                model.add(threeSequence);
            }
        }
        return model;

    }
    //***********************提取器结束******************************


    //***********************提示******************************
    /**
     * 炸弹提示提取器
     * @constructor
     */
    var BombHintTaker =function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     * @returns {*} Return the list of entity,list[0] is the best one;
     */
    BombHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList)
            return entityList;
        var bomb = compareCardList.toEntity(Bomb);
        if(!bomb){
            return entityList;
        }


        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            var biggerBombModel = bombModel.filter(function (p) {
                return p.compareTo(bomb) > 0;
            });
            if(!!biggerBombModel && biggerBombModel.size > 0){
                biggerBombModel.sort();
                biggerBombModel.list.forEach(function (entity) {
                    entityList.push(entity);
                })
            }
        }

        var rocketModel = model.findModel(PokerType.ROCKET);
        if(!!rocketModel && rocketModel.size > 0){
            rocketModel.list.forEach(function (rocket) {
                entityList.push(rocket);
            })
        }


        return entityList;
    }








    /**
     * 对子提示提取器
     * @constructor
     */
    var PairOutTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     */
    PairOutTaker.prototype.take =function (model) {
        var entityList = [];

        //如果有对子，则跟之
        var pairModel = model.findModel(PokerType.PAIR );
        if (!!pairModel && pairModel.size > 0) {
            pairModel.list.forEach(function (pair) {
                entityList.push(pair);
            });
        }
        //否则拆4连以上的双顺顶张跟之
        var pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE,function(p){
            return p.size >= 8;
        });
        if (!!pairSequenceModel && pairSequenceModel.size > 0) {
            for(var i=0;i<pairSequenceModel.size;i++){
                var pairSequence = pairSequenceModel.list[i];
                var pairTaker = new PairTaker();
                pairModel = pairSequence.take(pairTaker);
                if (!!pairModel && pairModel.size > 0) {
                    var biggerPairModel = pairModel;
                    if(!!biggerPairModel && biggerPairModel.size > 0){
                        biggerPairModel.sort();
                        biggerPairModel.list.forEach(function (pair) {
                            entityList.push(pair);
                        })
                    }
                }
            }
        }
        //否则拆三条跟之
        var threeBarModel = model.findModel(PokerType.THREE_BAR);
        if (!!threeBarModel && threeBarModel.size > 0) {
            var pairTaker = new PairTaker();
            var pairModel = threeBarModel.sort().list[0].take(pairTaker);
            if (!!pairModel){
                pairModel.list.forEach(function (pair) {
                    entityList.push(pair);
                })
            }
        }
        //否则拆对顺跟之
        pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE);
        if (!!pairSequenceModel && pairSequenceModel.size > 0)
        {
            for(var i = 0;i<pairSequenceModel.size;i++){
                var pairSequence = pairSequenceModel.list[i];
                var pairTaker = new PairTaker();
                pairModel = pairSequence.take(pairTaker);
                if (!!pairModel && pairModel.size > 0)
                {
                    var biggerPairModel = pairModel;
                    if(!!biggerPairModel && biggerPairModel.size > 0){
                        biggerPairModel.sort();
                        biggerPairModel.list.forEach(function (pair) {
                            entityList.push(pair);
                        })
                    }
                }
            }
        }

        //否则拆三顺跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE);
        if (!!threeSequenceModel && threeSequenceModel.size > 0)
        {
            var pairTaker = new PairTaker();
            pairModel = threeSequenceModel.toCardList().take(pairTaker);
            if (pairModel != null && pairModel.size > 0) {
                var biggerPairModel = pairModel;
                if(!!biggerPairModel && biggerPairModel.size > 0){
                    biggerPairModel.sort();
                    biggerPairModel.list.forEach(function (pair) {
                        entityList.push(pair);
                    })
                }
            }
        }
        if(entityList.length > 0){
            return entityList;
        }
        //最后提取单顺的对子
        var cards = model.toCardList();

        var pairTaker = new poker.PairTaker();
        var pairModel = cards.take(pairTaker);
        if(!pairModel || pairModel.size <= 0){
            return entityList;
        }
        var newPairModel = pairModel;
        newPairModel.list.forEach(function (pair) {
            entityList.push(pair);
        });

        return entityList;
    }

    /**
     * 对子提示提取器
     * @constructor
     */
    var PairHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     */
    PairHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList)
            return entityList;
        var compareEntity = compareCardList.toEntity(Pair);
        if (!compareEntity)
            return entityList;
        //如果有对子，则跟之
        var pairModel = model.findModel(PokerType.PAIR,function(p){
            return p.compareTo(compareEntity) > 0;
        });
        if (!!pairModel && pairModel.size > 0) {
            pairModel.list.forEach(function (pair) {
                entityList.push(pair);
            });
        }
        //否则拆4连以上的双顺顶张跟之
        var pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE,function(p){
            return p.size >= 8;
        });
        if (!!pairSequenceModel && pairSequenceModel.size > 0) {
            for(var i=0;i<pairSequenceModel.size;i++){
                var pairSequence = pairSequenceModel.list[i];
                var pairTaker = new PairTaker();
                pairModel = pairSequence.take(pairTaker);
                if (!!pairModel && pairModel.size > 0) {
                    var biggerPairModel = pairModel.filter(function(p) {
                        return p.compareTo(compareEntity) > 0;
                    });
                    if(!!biggerPairModel && biggerPairModel.size > 0){
                        biggerPairModel.sort();
                        biggerPairModel.list.forEach(function (pair) {
                            entityList.push(pair);
                        })
                    }
                }
            }
        }
        //否则拆三条跟之
        var threeBarModel = model.findModel(PokerType.THREE_BAR,function (p) {
            return p.list[0].compareTo(compareEntity.list[0]) > 0;
        });
        if (!!threeBarModel && threeBarModel.size > 0) {
            var pairTaker = new PairTaker();
            var pairModel = threeBarModel.sort().list[0].take(pairTaker);
            if (!!pairModel){
                pairModel.list.forEach(function (pair) {
                    entityList.push(pair);
                })
            }
        }
        //否则拆对顺跟之
        pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE);
        if (!!pairSequenceModel && pairSequenceModel.size > 0)
        {
            for(var i = 0;i<pairSequenceModel.size;i++){
                var pairSequence = pairSequenceModel.list[i];
                var pairTaker = new PairTaker();
                pairModel = pairSequence.take(pairTaker);
                if (!!pairModel && pairModel.size > 0)
                {
                    var biggerPairModel = pairModel.filter(function (p) {
                        return p.compareTo(compareEntity) > 0;
                    });
                    if(!!biggerPairModel && biggerPairModel.size > 0){
                        biggerPairModel.sort();
                        biggerPairModel.list.forEach(function (pair) {
                            entityList.push(pair);
                        })
                    }
                }
            }
        }

        //否则拆三顺跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE);
        if (!!threeSequenceModel && threeSequenceModel.size > 0)
        {
            var pairTaker = new PairTaker();
            pairModel = threeSequenceModel.toCardList().take(pairTaker);
            if (pairModel != null && pairModel.size > 0) {
                var biggerPairModel = pairModel.filter(function (p) {
                    return p.compareTo(compareEntity) > 0;
                });
                if(!!biggerPairModel && biggerPairModel.size > 0){
                    biggerPairModel.sort();
                    biggerPairModel.list.forEach(function (pair) {
                        entityList.push(pair);
                    })
                }
            }
        }
        //普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }


        if(entityList.length > 0){
            return entityList;
        }
        //最后提取单顺的对子
        var cards = model.toCardList();
        var pairTaker = new poker.PairTaker();
        var pairModel = cards.take(pairTaker);
        if(!pairModel || pairModel.size <= 0){
            return entityList;
        }
        var newPairModel = pairModel.filter(function (pair) {
            return pair.compareTo(compareEntity) > 0;
        });
        newPairModel.list.forEach(function (pair) {
            entityList.push(pair);
        });


        return entityList;
    }




    /**
     * 对顺提示提取器
     * @constructor
     */
    var PairSequenceHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     * @returns {*}
     */
    PairSequenceHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList || compareCardList.size <= 0)
            return entityList;
        var compareEntity = compareCardList.toEntity(PairSequence);
        if (!compareEntity || compareEntity.size <= 0)
            return entityList;
        var pairTaker = new PairTaker();
        var comparePairModel = compareEntity.take(pairTaker);
        if(!comparePairModel || comparePairModel.size <= 0){
            return entityList;
        }
        //如果有相应的牌型，则跟之
        var pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE,function (p) {
            return p.compareTo(compareEntity) > 0;
        });
        if (!!pairSequenceModel  && pairSequenceModel.size > 0)  {
            pairSequenceModel.sort();
            pairSequenceModel.list.forEach(function (entity) {
                entityList.push(entity);
            });
        }
        //否则拆不同张数的双顺
        pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE,function(p){
            return p.size > compareEntity.size;
        });
        if (!!pairSequenceModel && pairSequenceModel.size > 0) {
            //将双顺拆分成
            var pairTaker = new PairTaker();
            var pairModel = pairSequenceModel.toCardList().take(pairTaker);
            if(!!pairModel && pairModel.size >0) {
                var newPairModel = pairModel.filter(function (p) {
                    return p.compareTo(comparePairModel.list[0]) > 0;
                });
                if (newPairModel.size < comparePairModel.size)
                    return entityList;

                for (var k = 0; k <= newPairModel.size-comparePairModel.size; k++) {
                    var newPairSequence = new PairSequence();
                    for (var i = 0; i < comparePairModel.size; i++) {
                        newPairSequence.addList(newPairModel.list[i+k]);

                    }
                    entityList.push(newPairSequence);
                }
            }

        }
        //否则拆不同张数的三顺，
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE,function(p){
            return p.size >= compareEntity.size;
        });
        if (!!threeSequenceModel && threeSequenceModel.size > 0)  {
            //将三顺拆分成双顺
            var pairTaker= new PairTaker();
            var pairModel = threeSequenceModel.toCardList().take(pairTaker);
            if(!!pairModel && pairModel.size > 0){
                var newPairModel =  pairModel.filter(function(p){
                    return p.compareTo(comparePairModel.list[0]) > 0;
                });
                if (newPairModel.size > comparePairModel.size){
                    var newPairSequence = new PairSequence();
                    for (var i = 0; i < comparePairModel.size; i++) {
                        newPairSequence.addList(newPairModel.list[i]);
                    }
                    entityList.push(newPairSequence);
                }
            }
        }
        //普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }


        return entityList;

    }


    /**
     * 单张出牌提取器
     * @constructor
     */
    var SingleOutTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     */
    SingleOutTaker.prototype.take =function (model) {
        var entityList = [];

        //如果手中有单牌，则跟之
        var singleModel = model.findModel(PokerType.SINGLE);
        if (!!singleModel && singleModel.size > 0){
            singleModel.sort();
            singleModel.list.forEach(function (single) {
                entityList.push(single);
            })
        }
        //否则拆2跟之
        var handCardList = model.toCardList();
        if (handCardList.exists(poker.CardValue.Z) && handCardList.findNumberByValue(poker.CardValue.Z) <= 3) {
            var zSingle = new poker.Single();
            zSingle.add(handCardList.findByValue(poker.CardValue.Z));
            entityList.push(zSingle);
        }
        //否则拆对牌跟之
        var pairModel = model.findModel(PokerType.PAIR );
        if (!!pairModel && pairModel.size > 0) {

            pairModel.sort();
            pairModel.list.forEach(function (pair) {
                var zSingle = new poker.Single();
                zSingle.add(pair.list[0]);
                entityList.push(zSingle);
                var zSingle2 = new poker.Single();
                zSingle2.add(pair.list[1]);
                entityList.push(zSingle2);
            });
        }

        //否则拆6连以上的单顺顶张跟之
        var singleSequenceModel = model.findModel(PokerType.SINGLE_SEQUENCE,function(p){
            return p.size >= 6 ;
        });
        if (!!singleSequenceModel && singleSequenceModel.size > 0) {
            singleSequenceModel.sort();
            singleSequenceModel.list.forEach(function (singleSequence) {
                singleSequence.sort();
                var card = singleSequence.list[singleSequence.size - 1];
                var returnSingle = new poker.Single();
                returnSingle.add(card);
                entityList.push(returnSingle);
            });
        }
        //否则拆三条跟之
        var threeBarModel = model.findModel(PokerType.THREE_BAR );
        if (!!threeBarModel && threeBarModel.size > 0) {
            threeBarModel.sort();
            threeBarModel.list.forEach(function (threeBar) {
                var zSingle = new poker.Single();
                zSingle.add(threeBar.list[0]);
                entityList.push(zSingle);
            });
        }
        //否则拆三顺跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE);
        if (!!threeSequenceModel && threeSequenceModel.size > 0) {
            var singleTaker = new SingleTaker();
            singleModel = threeSequenceModel.toCardList().take(singleTaker);
            if (!!singleModel && singleModel.size > 0) {
                var biggerSingleModel = singleModel;
                if (!!biggerSingleModel && biggerSingleModel.size > 0){
                    biggerSingleModel.sort();
                    biggerSingleModel.list.forEach(function (single) {
                        entityList.push(single);
                    });
                }
            }
        }
        //否则拆5连单顺跟之
        singleSequenceModel = model.findModel(PokerType.SINGLE_SEQUENCE);
        if (!!singleSequenceModel && singleSequenceModel.size > 0) {
            var singleTaker = new SingleTaker();
            singleModel = singleSequenceModel.toCardList().take(singleTaker);
            if (!!singleModel && singleModel.size > 0) {
                var biggerSingleModel = singleModel;
                if (!!biggerSingleModel && biggerSingleModel.size > 0){
                    biggerSingleModel.sort();
                    biggerSingleModel.list.forEach(function (single) {
                        entityList.push(single);
                    });
                }
            }
        }
        //否则拆双顺跟之，
        var pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE);
        if (!!pairSequenceModel && pairSequenceModel.size > 0) {
            var singleTaker = new SingleTaker();
            singleModel = pairSequenceModel.toCardList().take(singleTaker);
            if (!!singleModel && singleModel.size > 0) {
                var biggerSingleModel = singleModel;
                if (!!biggerSingleModel && biggerSingleModel.size > 0){
                    biggerSingleModel.sort();
                    biggerSingleModel.list.forEach(function (single) {
                        entityList.push(single);
                    })
                }
            }
        }

        return entityList;
    }

    /**
     * 单张提示提取器
     * @constructor
     */
    var SingleHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     */
    SingleHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList || compareCardList.size <= 0)
            return entityList;

        //判断牌型是否正确
        var compareSingle = compareCardList.toEntity(Single);
        if (!compareSingle || compareSingle.size != 1)
            return entityList;
        //如果手中有单牌，则跟之
        var singleModel = model.findModel(PokerType.SINGLE,function(p){
            return p.compareTo(compareSingle) > 0;
        });
        if (!!singleModel && singleModel.size > 0){
            singleModel.sort();
            singleModel.list.forEach(function (single) {
                entityList.push(single);
            })
        }
        //否则拆2跟之
        var handCardList = model.toCardList();
        if (handCardList.exists(poker.CardValue.Z) && handCardList.findNumberByValue(poker.CardValue.Z) <= 3) {
            var zSingle = new poker.Single();
            zSingle.add(handCardList.findByValue(poker.CardValue.Z));
            if (zSingle.compareTo(compareSingle) > 0)
                entityList.push(zSingle);
        }
        //否则拆对牌跟之
        var pairModel = model.findModel(PokerType.PAIR,function (p) {
            return p.list[0].compareTo(compareSingle.list[0]) > 0;
        });
        if (!!pairModel && pairModel.size > 0) {

            pairModel.sort();
            pairModel.list.forEach(function (pair) {
                var zSingle = new poker.Single();
                zSingle.add(pair.list[0]);
                entityList.push(zSingle);
            });
        }

        //否则拆6连以上的单顺顶张跟之
        var singleSequenceModel = model.findModel(PokerType.SINGLE_SEQUENCE,function(p){
            return p.size >= 6 && p.list[p.size - 1].compareTo(compareSingle.list[0])>0;
        });
        if (!!singleSequenceModel && singleSequenceModel.size > 0) {
            singleSequenceModel.sort();
            singleSequenceModel.list.forEach(function (singleSequence) {
                singleSequence.sort();
                var card = singleSequence.list[singleSequence.size - 1];
                var returnSingle = new poker.Single();
                returnSingle.add(card);
                entityList.push(returnSingle);
            });
        }
        //否则拆三条跟之
        var threeBarModel = model.findModel(PokerType.THREE_BAR,function(p){
            return p.list[0].compareTo(compareSingle.list[0])>0;
        });
        if (!!threeBarModel && threeBarModel.size > 0) {
            threeBarModel.sort();
            threeBarModel.list.forEach(function (threeBar) {
                var zSingle = new poker.Single();
                zSingle.add(threeBar.list[0]);
                entityList.push(zSingle);
            });
        }
        //否则拆三顺跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE);
        if (!!threeSequenceModel && threeSequenceModel.size > 0) {
            var singleTaker = new SingleTaker();
            singleModel = threeSequenceModel.toCardList().take(singleTaker);
            if (!!singleModel && singleModel.size > 0) {
                var biggerSingleModel = singleModel.filter(function(p){
                    return p.compareTo(compareSingle) > 0
                });
                if (!!biggerSingleModel && biggerSingleModel.size > 0){
                    biggerSingleModel.sort();
                    biggerSingleModel.list.forEach(function (single) {
                        entityList.push(single);
                    });
                }
            }
        }
        //否则拆5连单顺跟之
        singleSequenceModel = model.findModel(PokerType.SINGLE_SEQUENCE);
        if (!!singleSequenceModel && singleSequenceModel.size > 0) {
            var singleTaker = new SingleTaker();
            singleModel = singleSequenceModel.toCardList().take(singleTaker);
            if (!!singleModel && singleModel.size > 0) {
                var biggerSingleModel = singleModel.filter(function(p){
                    return p.compareTo(compareSingle) > 0;
                });
                if (!!biggerSingleModel && biggerSingleModel.size > 0){
                    biggerSingleModel.sort();
                    biggerSingleModel.list.forEach(function (single) {
                        entityList.push(single);
                    });
                }
            }
        }
        //否则拆双顺跟之，
        var pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE);
        if (!!pairSequenceModel && pairSequenceModel.size > 0) {
            var singleTaker = new SingleTaker();
            singleModel = pairSequenceModel.toCardList().take(singleTaker);
            if (!!singleModel && singleModel.size > 0) {
                var biggerSingleModel = singleModel.filter(function (p) {
                    return p.compareTo(compareSingle) > 0;
                } );
                if (!!biggerSingleModel && biggerSingleModel.size > 0){
                    biggerSingleModel.sort();
                    biggerSingleModel.list.forEach(function (single) {
                        entityList.push(single);
                    })
                }
            }
        }
        var singleTaker = new SingleTaker();
        //拆王
        var singleModel = model.toCardList().take(singleTaker);
        singleModel.list.forEach(function (p) {
            //var some = entityList.some(function(entity){
            //    return entity.list[0].value == p.list[0].value;
            //})
            if(p.compareTo(compareSingle) > 0 && p.list[0].value > CardValue.Z){
                entityList.push(p);
            }
        });

        //拆王
        var handCardList = model.toCardList();
        if (handCardList.exists(poker.CardValue.BLACK_JOKER)) {
            var zSingle = new poker.Single();
            zSingle.add(handCardList.findByValue(poker.CardValue.BLACK_JOKER));
            if (zSingle.compareTo(compareSingle) > 0)
                entityList.push(zSingle);
        }
        if (handCardList.exists(poker.CardValue.RED_JOKER)) {
            var zSingle = new poker.Single();
            zSingle.add(handCardList.findByValue(poker.CardValue.RED_JOKER));
            if (zSingle.compareTo(compareSingle) > 0)
                entityList.push(zSingle);
        }

        //普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }

        return entityList;
    }


    /**
     * 单顺提示提取器
     * @constructor
     */
    var SingleSequenceHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     */
    SingleSequenceHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList || compareCardList.size <= 0)
            return entityList;
        var compareEntity = compareCardList.toEntity(SingleSequence);
        if (!compareEntity)
            return entityList;
        //如果有相应的牌型，则跟之
        var singleSequenceModel = model.findModel(PokerType.SINGLE_SEQUENCE,function (p) {
            return p.size == compareEntity.size && p.list[0].compareTo(compareEntity.list[0]) > 0;
        });
        if (!!singleSequenceModel && singleSequenceModel.size > 0){
            singleSequenceModel.sort();
            singleSequenceModel.list.forEach(function (singleSequence) {
                entityList.push(singleSequence);
            })
        }
        //否则拆相同张数的双顺跟之
        var pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE,function(p){
            return p.size == compareEntity.size * 2;
        });
        if (!!pairSequenceModel && pairSequenceModel.size > 0) {
            singleSequenceModel = new SingleSequenceModel();
            pairSequenceModel.list.forEach(function (pairSequence) {
                var newSingleSequence = pairSequence.toSingleSequenceModel().list[0];
                if (newSingleSequence.compareTo(compareEntity) > 0)
                    singleSequenceModel.add(newSingleSequence);
            })

            if(singleSequenceModel.size >0){
                singleSequenceModel.sort();
                singleSequenceModel.list.forEach(function (singleSequence) {
                    entityList.push(singleSequence);
                })
            }
        }
        //否则拆相同张数的三顺跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE,function(p){
            return p.size == compareEntity.size * 3
        });
        if (!!threeSequenceModel && threeSequenceModel.size > 0)  {
            singleSequenceModel = new SingleSequenceModel();
            threeSequenceModel.list.forEach(function (threeSequence) {
                var newSingleSequence = threeSequence.toSingleSequenceModel().list[0];
                if (newSingleSequence.compareTo(compareEntity) > 0)
                    singleSequenceModel.add(newSingleSequence);
            })

            if(singleSequenceModel.size>0){
                singleSequenceModel.sort();
                singleSequenceModel.list.forEach(function (singleSequence) {
                    entityList.push(singleSequence);
                })
            }
        }
        //否则拆不同张数的连牌
        singleSequenceModel = model.findModel(PokerType.SINGLE_SEQUENCE,function(p){
            return p.size > compareEntity.size;
        } );

        if (!!singleSequenceModel && singleSequenceModel.size > 0) {
            singleSequenceModel.list.forEach(function (singleSequence) {
                var newSingleSequenceList = singleSequence.takeBiggerList(compareEntity);
                if (!!newSingleSequenceList){
                    newSingleSequenceList.forEach(function (newSingleSequence) {
                        entityList.push(newSingleSequence);
                    })
                }
            });
        }

        //否则拆不同张数的双顺跟之
        pairSequenceModel = model.findModel(PokerType.PAIR_SEQUENCE,function(p){
            return p.size > compareEntity.size * 2;
        });
        if (!!pairSequenceModel && pairSequenceModel.size > 0)
        {
            singleSequenceModel = new SingleSequenceModel();
            pairSequenceModel.list.forEach(function (pairSequence) {
                var newSingleSequence = pairSequence.toSingleSequenceModel().list[0];
                newSingleSequence = newSingleSequence.takeBigger(compareEntity);
                if (!!newSingleSequence)
                    singleSequenceModel.add(newSingleSequence);
            });
            if(singleSequenceModel.size >0 ){
                singleSequenceModel.sort();
                singleSequenceModel.list.forEach(function (singleSequence) {
                    entityList.push(singleSequence);
                })
            }
        }
        //否则拆不同张数的三顺,
        threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE,function(p){
            return p.size > compareEntity.size * 3;
        });
        if (!!threeSequenceModel && threeSequenceModel.size > 0)  {
            singleSequenceModel = new SingleSequenceModel();
            threeSequenceModel.list.forEach(function (threeSequence) {
                var newSingleSequence = threeSequence.toSingleSequenceModel().list[0];
                newSingleSequence = newSingleSequence.takeBigger(compareEntity);
                if (newSingleSequence != null)
                    singleSequenceModel.add(newSingleSequence);
            });
            if(singleSequenceModel.size > 0){
                singleSequenceModel.sort();
                singleSequenceModel.list.forEach(function (singleSequence) {
                    entityList.push(singleSequence);
                });
            }
        }
//普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }

        return entityList;
    }


    /**
     * 三条提示提取器
     * @constructor
     */
    var ThreeBarNoBombHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     * @returns {*}
     */
    ThreeBarNoBombHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList || compareCardList.size <= 0)
            return entityList;
        var compareEntity = compareCardList.toEntity(ThreeBar);
        if (compareEntity == null)
            return entityList;

        //有三条则压之
        var threeBarModel = model.findModel(PokerType.THREE_BAR,function(p){
            return p.compareTo(compareEntity) > 0;
        });
        if (!!threeBarModel && threeBarModel.size > 0) {
            threeBarModel.sort();
            threeBarModel.list.forEach(function (entity) {
                entityList.push(entity);
            });
        }

        //否则拆三顺跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE);
        if (!!threeSequenceModel  && threeSequenceModel.size > 0){
            var threeBarTaker = new ThreeBarTaker();
            threeBarModel = threeSequenceModel.toCardList().take(threeBarTaker);
            if (!!threeBarModel && threeBarModel.size > 0) {
                var biggerThreeBarModel = threeBarModel.filter(function (p) {
                    return p.compareTo(compareEntity) > 0;
                });
                if(!!biggerThreeBarModel && biggerThreeBarModel.size > 0){
                    biggerThreeBarModel.sort();
                    biggerThreeBarModel.list.forEach(function (entity) {
                        entityList.push(entity);
                    })
                }
            }
        }

        return entityList;
    }
    /**
     * 三条提示提取器
     * @constructor
     */
    var ThreeBarHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     * @returns {*}
     */
    ThreeBarHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList || compareCardList.size <= 0)
            return entityList;
        var compareEntity = compareCardList.toEntity(ThreeBar);
        if (compareEntity == null)
            return entityList;

        //有三条则压之
        var threeBarModel = model.findModel(PokerType.THREE_BAR,function(p){
            return p.compareTo(compareEntity) > 0;
        });
        if (!!threeBarModel && threeBarModel.size > 0) {
            threeBarModel.sort();
            threeBarModel.list.forEach(function (entity) {
                entityList.push(entity);
            });
        }

        //否则拆三顺跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE);
        if (!!threeSequenceModel  && threeSequenceModel.size > 0){
            var threeBarTaker = new ThreeBarTaker();
            threeBarModel = threeSequenceModel.toCardList().take(threeBarTaker);
            if (!!threeBarModel && threeBarModel.size > 0) {
                var biggerThreeBarModel = threeBarModel.filter(function (p) {
                    return p.compareTo(compareEntity) > 0;
                });
                if(!!biggerThreeBarModel && biggerThreeBarModel.size > 0){
                    biggerThreeBarModel.sort();
                    biggerThreeBarModel.list.forEach(function (entity) {
                        entityList.push(entity);
                    })
                }
            }
        }
        //普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }

        return entityList;
    }



    /**
     * 三条带二提示提取器
     * @constructor
     */
    var ThreeBarWithTwoHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     * @returns {*}
     */
    ThreeBarWithTwoHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList || compareCardList.size <= 0){
            return entityList;
        }
        var compareEntity = compareCardList.toEntity(ThreeBarWithTwo);
        if (!compareEntity)
            return entityList;
        var threeBarTaker = new ThreeBarTaker();
        var compareThreeBarModel = compareEntity.take(threeBarTaker);
        if (!compareThreeBarModel || compareThreeBarModel.size <= 0)  {
            return entityList;
        }
        //var myThreeBarModel = model.toCardList().take(threeBarTaker)
        //var threeBarList = myThreeBarModel.takeBigger(compareThreeBarModel.list[0]);

        var threeBarNoBombHintTaker = new ThreeBarNoBombHintTaker();
        var threeBarList = threeBarNoBombHintTaker.take(model,compareThreeBarModel.list[0]);

        if (!!threeBarList && threeBarList.length > 0){
            threeBarList.forEach(function (threeBar) {
                var newCardList = model.toCardList().removeList(threeBar);
                if (!newCardList || newCardList.size <=0)
                    return;
                var compositeTaker = new CompositeTaker();
                var newModel = newCardList.take(compositeTaker);
                if (!!newModel && newModel.size > 0){

                    //var singleModel = newModel.findModel(PokerType.SINGLE);

                    var singleOutTaker = new SingleOutTaker();
                    var singleList = singleOutTaker.take(newModel);
                    var singleModel = new SingleModel();
                    singleModel.list = singleList;


                    if (!!singleModel && singleModel.size > 0) {
                        //singleModel.sort();
                        var threeBarWithTwo = new ThreeBarWithTwo();

                        threeBarWithTwo.add(threeBar);
                        if(singleModel.list.length >=1){
                            threeBarWithTwo.add(singleModel.list[0]);
                        }
                        if(singleModel.list.length >=2){
                            threeBarWithTwo.add(singleModel.list[1]);
                        }
                        entityList.push(threeBarWithTwo)
                    }
                }
            })
        }


        //普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }

        return entityList;
    }



    ///**
    // * 三顺提示提取器
    // * @constructor
    // */
    //var ThreeSequenceOutTaker = function () {
    //
    //}
    ///**
    // * 从牌集合中提取比传入牌型大的最适合的牌型
    // * @param model
    // * @param compareCardList
    // */
    //ThreeSequenceOutTaker.prototype.take =function (model) {
    //    var entityList = [];
    //
    //    //如果有相应的牌型，则跟之
    //    var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE);
    //    if (!!threeSequenceModel && threeSequenceModel.size > 0) {
    //        threeSequenceModel.sort();
    //        threeSequenceModel.list.forEach(function (entity) {
    //            entityList.push(entity);
    //        })
    //    }
    //    //否则可以将大的三顺拆成小的三顺跟之
    //    threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE);
    //    if (!!threeSequenceModel && threeSequenceModel.size > 0) {
    //        var threeBarTaker = new ThreeBarTaker();
    //        var threeBarModel = threeSequenceModel.toCardList().take(threeBarTaker);
    //        if(!!threeBarModel && threeBarModel.size >0){
    //            threeBarModel.sort();
    //
    //            var count = compareEntity.size / 3;
    //            if (!!threeBarModel && threeBarModel.size >= count) {
    //                for(var p=0;p<=threeBarModel.size-count;p++){
    //                    var cardList = new Cards();
    //                    for (var i = p; i < p+count; i++) {
    //                        cardList.addList(threeBarModel.list[i]);
    //                    }
    //                    var entity =  cardList.toEntity(ThreeSequence);
    //                    entityList.push(entity);
    //                }
    //            }
    //        }
    //    }
    //
    //    return entityList;
    //
    //}

    /**
     * 三顺提示提取器
     * @constructor
     */
    var ThreeSequenceNoBombHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     */
    ThreeSequenceNoBombHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList || compareCardList.size <= 0)
            return entityList;
        var compareEntity = compareCardList.toEntity(ThreeSequence);
        if (!compareEntity || compareEntity.size <= 0)
            return entityList;
        //如果有相应的牌型，则跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE,function(p){
            return p.compareTo(compareEntity) > 0
        });
        if (!!threeSequenceModel && threeSequenceModel.size > 0) {
            threeSequenceModel.sort();
            threeSequenceModel.list.forEach(function (entity) {
                entityList.push(entity);
            })
        }
        //否则可以将大的三顺拆成小的三顺跟之
        threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE,function(p){
            return p.size > compareEntity.size;
        });
        if (!!threeSequenceModel && threeSequenceModel.size > 0) {
            var threeBarTaker = new ThreeBarTaker();
            var threeBarModel = threeSequenceModel.toCardList().take(threeBarTaker);
            if(!!threeBarModel && threeBarModel.size >0){
                threeBarModel.sort();
                threeBarModel = threeBarModel.filter(function (p) {
                    return p.list[0].compareTo(compareEntity.list[0]) > 0;
                } );
                var count = compareEntity.size / 3;
                if (!!threeBarModel && threeBarModel.size >= count) {
                    for(var p=0;p<=threeBarModel.size-count;p++){
                        var cardList = new Cards();
                        for (var i = p; i < p+count; i++) {
                            cardList.addList(threeBarModel.list[i]);
                        }
                        var entity =  cardList.toEntity(ThreeSequence);
                        entityList.push(entity);
                    }
                }
            }
        }

        return entityList;

    }

    /**
     * 三顺提示提取器
     * @constructor
     */
    var ThreeSequenceHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     */
    ThreeSequenceHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList || compareCardList.size <= 0)
            return entityList;
        var compareEntity = compareCardList.toEntity(ThreeSequence);
        if (!compareEntity || compareEntity.size <= 0)
            return entityList;
        //如果有相应的牌型，则跟之
        var threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE,function(p){
            return p.compareTo(compareEntity) > 0
        });
        if (!!threeSequenceModel && threeSequenceModel.size > 0) {
            threeSequenceModel.sort();
            threeSequenceModel.list.forEach(function (entity) {
                entityList.push(entity);
            })
        }
        //否则可以将大的三顺拆成小的三顺跟之
        threeSequenceModel = model.findModel(PokerType.THREE_SEQUENCE,function(p){
            return p.size > compareEntity.size;
        });
        if (!!threeSequenceModel && threeSequenceModel.size > 0) {
            var threeBarTaker = new ThreeBarTaker();
            var threeBarModel = threeSequenceModel.toCardList().take(threeBarTaker);
            if(!!threeBarModel && threeBarModel.size >0){
                threeBarModel.sort();
                threeBarModel = threeBarModel.filter(function (p) {
                    return p.list[0].compareTo(compareEntity.list[0]) > 0;
                } );
                var count = compareEntity.size / 3;
                if (!!threeBarModel && threeBarModel.size >= count) {
                    for(var p=0;p<=threeBarModel.size-count;p++){
                        var cardList = new Cards();
                        for (var i = p; i < p+count; i++) {
                            cardList.addList(threeBarModel.list[i]);
                        }
                        var entity =  cardList.toEntity(ThreeSequence);
                        entityList.push(entity);
                    }
                }
            }
        }
//普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }

        return entityList;

    }




    /**
     * 三顺带对子提示提取器
     * @constructor
     */
    var ThreeSequenceWithPairHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     * @returns {*}
     */
    ThreeSequenceWithPairHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList)
            return entityList;
        var compareEntity = compareCardList.toEntity(ThreeSequenceWithPair);
        if (!compareEntity)
            return entityList;
        var threeSequenceTaker = new ThreeSequenceTaker();
        var compareThreeSequenceModel = compareEntity.take(threeSequenceTaker);
        if (!compareThreeSequenceModel || compareThreeSequenceModel.size <= 0) {
            return entityList;
        }

        //var threeSequenceModel = model.toCardList().take(threeSequenceTaker)
        //var threeSequenceList = threeSequenceModel.takeBigger(compareThreeSequenceModel.list[0]);

        var threeSequenceNoBombHintTaker = new ThreeSequenceNoBombHintTaker();
        var threeSequenceList = threeSequenceNoBombHintTaker.take(model,compareThreeSequenceModel.list[0]);


        if (!!threeSequenceList && threeSequenceList.length > 0){
            threeSequenceList.forEach(function (threeSequence) {
                var newCardList = model.toCardList().removeList(threeSequence);
                if (!newCardList  || newCardList.size <= 0)
                    return;
                var compositeTaker = new CompositeTaker(PokerType.PAIR);
                var newModel = newCardList.take(compositeTaker);
                if (!newModel || newModel.size <= 0)
                    return;
                var pairCount = threeSequence.size / 3;

                //var pairModel = newModel.findModel(PokerType.PAIR);
                var pairOutTaker = new PairOutTaker();
                var pairList = pairOutTaker.take(newModel);
                var pairModel = new PairModel();
                pairModel.list = pairList;

                var newThreeSequenceWithPair = new ThreeSequenceWithPair();
                newThreeSequenceWithPair.addList(threeSequence);
                if(!!pairModel &&pairModel.size >=pairCount){
                    for (var i = 0; i < pairCount; i++) {
                        var pair = pairModel.list[i];
                        newThreeSequenceWithPair.addList(pair);
                    }
                }
                var entity = newThreeSequenceWithPair.toEntity();

                if (!!entity && entity.pokerType == PokerType.THREE_SEQUENCE_WITH_PAIR){
                    entityList.push(entity);
                }
            });
        }


//普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }

        return entityList;
    }



    /**
     * 三顺带单张提示提取器
     * @constructor
     */
    var ThreeSequenceWithWingHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     * @returns {*}
     */
    ThreeSequenceWithWingHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList)
            return entityList;
        var compareEntity = compareCardList.toEntity(ThreeSequenceWithWing);
        if (!compareEntity)
            return entityList;
        var threeSequenceTaker = new ThreeSequenceTaker();
        var compareThreeSequenceModel = compareEntity.take(threeSequenceTaker);
        if (!compareThreeSequenceModel || compareThreeSequenceModel.size <= 0) {
            return entityList;
        }


        //var threeSequenceModel = model.toCardList().take(threeSequenceTaker)
        //var threeSequenceList = threeSequenceModel.takeBigger(compareThreeSequenceModel.list[0]);

        var threeSequenceNoBombHintTaker = new ThreeSequenceNoBombHintTaker();
        var threeSequenceList = threeSequenceNoBombHintTaker.take(model,compareThreeSequenceModel.list[0]);


        if (!!threeSequenceList && threeSequenceList.length > 0){
            threeSequenceList.forEach(function (threeSequence) {
                var newCardList = model.toCardList().removeList(threeSequence);
                if (!newCardList  || newCardList.size <= 0)
                    return;
                var compositeTaker = new CompositeTaker();
                var newModel = newCardList.take(compositeTaker);
                if (!newModel || newModel.size <= 0)
                    return;
                var singleCount = (threeSequence.size / 3) * 2;

                //var singleModel = newModel.findModel(PokerType.SINGLE);

                var singleOutTaker = new SingleOutTaker();
                var singleList = singleOutTaker.take(newModel);
                var singleModel = new SingleModel();
                singleModel.list = singleList;

                var newThreeSequenceWithWing = new ThreeSequenceWithWing();
                newThreeSequenceWithWing.addList(threeSequence);
                if(!!singleModel &&singleModel.size >=singleCount){
                    for (var i = 0; i < singleCount; i++) {
                        var single = singleModel.list[i];
                        newThreeSequenceWithWing.addList(single);
                    }
                }
                var entity = newThreeSequenceWithWing.toEntity();

                if (!!entity && entity.pokerType == PokerType.THREE_SEQUENCE_WITH_WING){
                    entityList.push(entity);
                }
            })
        }

//普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }

        return entityList;
    }
    /**
     * 四条带三单张提示提取器
     * @constructor
     */
    var BombWithThreeSingleHintTaker = function () {

    }
    /**
     * 从牌集合中提取比传入牌型大的最适合的牌型
     * @param model
     * @param compareCardList
     */
    BombWithThreeSingleHintTaker.prototype.take =function (model, compareCardList) {
        var entityList = [];
        if (!compareCardList)
            return entityList;
        var compareEntity = compareCardList.toEntity(BombWithThreeSingle);
        if (!compareEntity)
            return entityList;
        var bombTaker = new BombTaker();
        var compareBombModel = compareEntity.take(bombTaker);
        if (!compareBombModel || compareBombModel.size <= 0){
            return entityList;
        }

        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            var bombList = bombModel.takeBigger(compareBombModel.list[0]);

            if (!!bombList && bombList.length > 0){
                bombList.forEach(function (bomb) {
                    var newCardList = model.toCardList().removeList(bomb);
                    if (!newCardList || newCardList.size <=0)
                        return;
                    var compositeTaker = new CompositeTaker();
                    var newModel = newCardList.take(compositeTaker);
                    if (!newModel || newModel.size <= 0)
                        return ;

                    var bombWithThreeSingle = new BombWithThreeSingle();
                    bombWithThreeSingle.addList(bomb);

                    //var singleModel = newModel.findModel(PokerType.SINGLE);

                    var singleOutTaker = new SingleOutTaker();
                    var singleList = singleOutTaker.take(newModel);
                    var singleModel = new SingleModel();
                    singleModel.list = singleList;

                    if (!!singleModel && singleModel.size >=3){
                        bombWithThreeSingle.addList(singleModel.list[0]);
                        bombWithThreeSingle.addList(singleModel.list[1]);
                        bombWithThreeSingle.addList(singleModel.list[2]);
                        entityList.push(bombWithThreeSingle);
                    }
                });
            }


        }

        //普通炸弹炸掉它
        var bombModel = model.findModel(PokerType.BOMB);
        if(!!bombModel && bombModel.size > 0){
            bombModel.list.forEach(function (bomb) {
                entityList.push(bomb);
            })
        }

        return entityList;
    }




    //***********************提示******************************

    var random =  function random(min,max){
        return Math.floor(min+Math.random()*(max-min));
    }

    var Deck = function(){
        if (typeof this !== 'object') {
            throw new TypeError('Deck must be constructed via new');
        }

        Cards.apply(this,arguments);
        this.initial();
    }
    inherits(Deck,Cards);
    Deck.prototype.check = function(){
        if (this.list.length != 48)
            return false;
        return true;
    }
    Deck.prototype.initial = function() {
        for (var j = CardType.DIAMOND; j <= CardType.SPADE; j++)  {
            for (var i = CardValue[3]; i <= CardValue.A; i++) {
                var card = new Card(i, j);
                this.list.push(card);
            }
        }
        this.remove(new Card(CardValue.A,CardType.SPADE))
        var card = new Card(CardValue.Z,CardType.SPADE);
        this.list.push(card);
    }
    Deck.prototype.dispatch = function() {
        if(this.list.length <= 0)
            return null;
        if(arguments.length === 1 && arguments[0] instanceof Card){

            return this.dispatchCard(arguments[0]);
        }
        if(arguments.length === 1 && typeof arguments[0] === 'number' && !isNaN(arguments[0])){
            if(arguments[0] == 1){
                return this.list.shift();
            }
            return this.dispatchList(arguments[0]);
        }
        return this.list.shift();
    }
    Deck.prototype.dispatchCard = function(card) {
        var c = this.find(card);
        this.remove(c);
        return c;
    }
    Deck.prototype.dispatchList = function(number) {
        if(this.list.length < number){
            throw TypeError("Deck has not enough card")
        }
        var list = [];
        for (var i = 0; i < number; i++) {
            var card = this.dispatch();
            list.push(card);
        }
        return list;
    }
    Deck.prototype.shuffle = function(times) {
        var a, b;
        while (times-- > 0) {
            do {
                a = random(0,this.list.length);
                b = random(0,this.list.length);
            } while (a == b);
            var card1 = this.list[a];
            var card2 = this.list[b];
            this.list[a] = card2;
            this.list[b] = card1;
        }
    }
    /**
     * hint cards from hand cards,when previous player out a hand cards.
     * @param {Array} handCards
     * @param {Array} compareCards
     * @example
     *  var handCards = [{value:3,type:4},{value:4,type:4},{value:5,type:4},{value:6,type:4}];
     *  var compareCards = [{value:3,type:2}];
     *  var hintList = hint(handCards,compareCards);
     *  var bestOne = hintList[0];
     */
    var hint = function (handCards,compareCards) {
        var entityList = [];
        if(!compareCards || !handCards){
            return entityList;
        }
        var compareCardList = null;
        if(compareCards instanceof Cards){
            compareCardList = compareCards;
        } else {
            compareCardList = new Cards(compareCards);
        }

        var compareEntity = compareCardList.toEntity();
        if(!compareEntity){
            return entityList;
        }
        if(!handCards || handCards.length <= 0){
            return entityList;
        }
        var cards = null;
        if(handCards instanceof Cards){
            cards = handCards;
        } else {
            cards = new Cards(handCards);
        }
        switch (compareEntity.pokerType){
            case PokerType.BOMB:
                var compositeTaker = new poker.CompositeTaker();
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var bombHintTaker = new poker.BombHintTaker();
                return bombHintTaker.take(model,compareEntity);
            case PokerType.BOMB_WITH_THREE_SINGLE:
                var compositeTaker = new poker.CompositeTaker();
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var bombWithThreeSingleHintTaker = new poker.BombWithThreeSingleHintTaker();
                return bombWithThreeSingleHintTaker.take(model,compareEntity);

            case PokerType.SINGLE:
                var compositeTaker = new poker.CompositeTaker();
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var singleHintTaker = new poker.SingleHintTaker();
                return singleHintTaker.take(model,compareEntity);
            case PokerType.SINGLE_SEQUENCE:
                var compositeTaker = new poker.CompositeTaker(PokerType.SINGLE_SEQUENCE);
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var singleSequenceHintTaker = new poker.SingleSequenceHintTaker();
                return singleSequenceHintTaker.take(model,compareEntity);

            case PokerType.THREE_BAR_WITH_TWO:
                var compositeTaker = new poker.CompositeTaker(PokerType.THREE_BAR);
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var threeBarWithTwoHintTaker = new poker.ThreeBarWithTwoHintTaker();
                return threeBarWithTwoHintTaker.take(model,compareEntity);
            case PokerType.PAIR:
                var compositeTaker = new poker.CompositeTaker();
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var pairHintTaker = new poker.PairHintTaker();
                return pairHintTaker.take(model,compareEntity);
            case PokerType.PAIR_SEQUENCE:
                var compositeTaker = new poker.CompositeTaker(PokerType.PAIR_SEQUENCE);
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var pairSequenceHintTaker = new poker.PairSequenceHintTaker();
                var pairEntityList = pairSequenceHintTaker.take(model,compareEntity);
                //最后提取双顺，保证有双顺总提取
                var cards2 = model.toCardList();
                pairEntityList.forEach(function (entity) {
                    cards2.removeList(entity);
                });
                var compositeTaker2 = new poker.CompositeTaker(PokerType.PAIR_SEQUENCE);
                var model2 =cards2.take(compositeTaker2);
                if(!model2){
                    return entityList
                }
                var pairEntityList2 = pairSequenceHintTaker.take(model2,compareEntity);
                pairEntityList2.forEach(function (entity) {
                    pairEntityList.push(entity);
                })
                return pairEntityList;

            case PokerType.THREE_SEQUENCE:
                var compositeTaker = new poker.CompositeTaker(PokerType.THREE_SEQUENCE);
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var threeSequenceHintTaker = new poker.ThreeSequenceHintTaker();
                return threeSequenceHintTaker.take(model,compareEntity);

            case PokerType.THREE_SEQUENCE_WITH_WING:
                var compositeTaker = new poker.CompositeTaker(PokerType.THREE_SEQUENCE);
                var model =cards.take(compositeTaker);
                if(!model){
                    return entityList
                }
                var threeSequenceWithWingHintTaker = new poker.ThreeSequenceWithWingHintTaker();
                return threeSequenceWithWingHintTaker.take(model,compareEntity);
        }
        return entityList;

    }
    var poker = {
        CardType:CardType,
        CardValue:CardValue,
        Card:Card,
        Order:Order,
        PokerType:PokerType,
        Cards:Cards,
        Bomb:Bomb,//炸弹实体
        Pair:Pair,
        PairSequence:PairSequence,
        Single:Single,
        SingleSequence:SingleSequence,
        //ThreeBar:ThreeBar,
        ThreeBarWithTwo:ThreeBarWithTwo,
        //ThreeSequence:ThreeSequence,
        ThreeSequenceWithWing:ThreeSequenceWithWing,
        BombWithThreeSingle:BombWithThreeSingle,
        BombModel:BombModel,//炸弹模型
        PairModel:PairModel,
        PairSequenceModel:PairSequenceModel,
        RocketModel:RocketModel,
        SingleModel:SingleModel,
        SingleSequenceModel:SingleSequenceModel,
        ThreeBarModel:ThreeBarModel,
        ThreeSequenceModel:ThreeSequenceModel,
        CompositeModel:CompositeModel,
        BombTaker:BombTaker,//炸弹提取
        FiveSingleSequenceTaker:FiveSingleSequenceTaker,
        PairTaker:PairTaker,
        PairSequenceTaker:PairSequenceTaker,

        SingleTaker:SingleTaker,
        SingleSequenceTaker:SingleSequenceTaker,
        NormalSequenceTaker:NormalSequenceTaker,
        ThreeBarTaker:ThreeBarTaker,
        ThreeSequenceTaker:ThreeSequenceTaker,
        CompositeTaker:CompositeTaker,
        BombHintTaker:BombHintTaker,
        BombWithThreeSingleHintTaker:BombWithThreeSingleHintTaker,
        ThreeBarHintTaker:ThreeBarHintTaker,//三条提示
        SingleHintTaker:SingleHintTaker,
        SingleSequenceHintTaker:SingleSequenceHintTaker,
        ThreeBarWithTwoHintTaker:ThreeBarWithTwoHintTaker,
        PairHintTaker:PairHintTaker,
        PairSequenceHintTaker:PairSequenceHintTaker,
        ThreeSequenceHintTaker:ThreeSequenceHintTaker,
        ThreeSequenceWithWingHintTaker:ThreeSequenceWithWingHintTaker,
        Deck:Deck,
        hint:hint,
    };

    if(typeof module !== 'undefined' && module.exports){
        module.exports = poker;
    } else if(typeof define === 'function' && define.amd){
        define([], function () {
            return poker;
        });
    } else {
        global.pdkPoker = poker;
    }
}(this));