/*
 sssPoker.js

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
 @copyright 爱度 2017.01

 @version 0.1.128
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
        '2': 2,//小2
        'NULL': 0//空
    }

    /**
     * Card is indicate a single card
     * @param {CardValue} value - the card's value
     * @param {CardType}  type  - the card's type
     * @example
     *      var card = new Card(3,1);//方块3
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
     * add the function reduce to the prototype of array
     */
    if (typeof Array.prototype.reduce != "function") {
        Array.prototype.reduce = function (callback, initialValue ) {
            var previous = initialValue, k = 0, length = this.length;
            if (typeof initialValue === "undefined") {
                previous = this[0];
                k = 1;
            }

            if (typeof callback === "function") {
                for (k; k < length; k++) {
                    this.hasOwnProperty(k) && (previous = callback(previous, this[k], k, this));
                }
            }
            return previous;
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

    var SpecialPokerType = {//十三水特殊牌型
        NULL                 : 0,//空
        NORMAL               : 1,//普通
        THREE_STRAIGHT       : 2,//三顺子
        THREE_FLUSH          : 3,//三同花
        SIX_PAIR             : 4,//六对半
        FIVE_PAIR_THREE      : 5,//五对冲三
        FOUR_THREE           : 6,//四套冲三
        FLUSH                : 7,//凑一色
        ALL_SMALL            : 8,//全小
        ALL_BIG              : 9,//全大
        THREE_BOMB           : 10,//三分天下
        THREE_STRAIGHT_FLUSH : 11,//三同花顺
        TWELVE_KING          : 12,//十二皇族
        DRAGON               : 13,//一条龙
        DRAGON_FLUSH         : 14//至尊清龙
    }

    var PokerType = { //多张牌牌型
        NULL          : 0,//空
        HIGH          : 1,//高牌,散牌
        PAIR          : 2,//一对
        TWO_PAIR      : 3,//两对
        THREE         : 4,//三条
        STRAIGHT      : 5,//顺子
        FLUSH         : 6,//同花
        FULL_HOUSE     : 7,//葫芦
        FOUR          : 8,//四条,铁支
        STRAIGHT_FLUSH : 9,//普通同花顺
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
        this.specialPokerType = SpecialPokerType.NULL;
        this.checked = false;
        var self = this;
        Object.defineProperty(this, "size", {
            configurable: true,
            enumerable: true,
            get: function () {
                return self.list.length;
            }
        });

    }
    Cards.prototype.getDistinctList = function(){
        var list = [];
        for(var i=0;i<this.size;i++){
            var card = this.list[i];
            var some = list.some(function(c){
                return c.value == card.value;
            });
            if(!some){
                list.push(card);
            }
        }

        return list;
    }
    Cards.prototype.size = function(){
        return this.list.length;
    }
    Cards.prototype.clone = function() {
        var other = Object.create(this);
        other.list = [];
        for(var i=0;i<this.list.length;i++){
            other.push(this.list[i]);
        }

        other.order = this.order;
        other.pokerType = this.pokerType;
        Object.defineProperty(other, "size", {
            get: function () {
                return other.list.length;
            }
        });
        return other;
    }
    /**
     * 是否存在传入牌值的5顺
     * @param {Number} cardValue - card's value
     * @return {Boolean} Returns 真假
     */
    Cards.prototype.existsFiveSequence = function(cardValue) {
        if (!this.list || this.list.length < 5)
            return false;
        if(cardValue == 14){
            for (var i = 2; i < 6; i++) {
                if (!this.exists(i)){
                    return false;
                }
            }
            return true;
        }
        for (var i = 0; i < 5; i++) {
            var cValue = cardValue + i;
            //if (cValue == CardValue.Z || cValue == CardValue.RED_JOKER || cValue == CardValue.BLACK_JOKER){
            //    return false;
            //}
            //两头顺
            if (!this.exists(cardValue + i)){
                return false;
            }
        }
        return true;

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
        for (var i = 0; i < this.size; i++) {
            if(this.list[i].value != other.list[i].value || this.list[i].type != other.list[i].type)
                return false;
        }
        return true;
    }
    Cards.prototype.existsFour = function() {
        var cardNumber;
        for (var i = 0; i < this.list.length; i++) {
            var c = this.list[i];
            cardNumber = 0;
            for (var j = 0; j < this.list.length; j++) {
                var card = this.list[j];
                if (c.value === card.value)
                    cardNumber++;
                if (cardNumber >= 4)
                    return true;
            }
        }
        return false;
    }

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

    Cards.prototype.isSequence = function(){
        if (this.list.length <= 1)
            return false;
        var cList = this;
        if(!this.order || this.order === Order.NULL){
            var cList = this.clone();
            cList.sort();
        }
        if(cList.size == 3 && cList.list[0].value==2&&cList.list[1].value==3&&cList.list[2].value==14){
            return true;
        }
        if(cList.size == 5 && cList.list[0].value==2&&cList.list[1].value==3&&cList.list[2].value==4
            &&cList.list[3].value==5&&cList.list[4].value==14){
            return true;
        }
        for (var i = 1; i < cList.list.length; i++) {
            var j = cList.list[i].value - cList.list[i-1].value;
            //if(Math.abs(j) == 12){
            //    continue;
            //}
            if (j != 1)
                return false;
        }
        return true;
    }

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
     * check the cards have some significance,example for entity etc.
     * @returns {boolean} true the number of cards is 1..5
     */
    Cards.prototype.check = function() {
        if (this.list.length <= 0 || this.list.length > 13){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.checked = true;
        return true;
    }
    /**
     * 比较器，两多张牌进行比较
     * @param cardList 多张牌
     * @returns {number} 大于1，小于-1，等于0
     */
    Cards.prototype.compareTo = function(other){
        if(!other)
            throw TypeError('other is null or undefined');
        if (this.list.length <= 0 || this.list.length > 5){
            throw TypeError("two cards's length must be between 1 and 5");
        }
        if(!this.checked){
            throw TypeError("it must not be checked,"+this.toString());
        }
        if(this.pokerType == PokerType.NULL){
            throw TypeError("this cards must not be Entity,please invoke toEntity function,"+this.toString());
        }
        if(other.pokerType == PokerType.NULL){
            throw TypeError("the other cards must not be Entity,please invoke toEntity function"+other.toString());
        }
        if(this.pokerType > other.pokerType)
            return 1;
        else  if(this.pokerType < other.pokerType)
            return -1;
        else
            return 0;
    }
    Cards.prototype.toString = function() {
        var s = '{list:[';
        for(var i in this.list){
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
                return item.value === value;
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
        if(entity.check()){
            return entity;
        }
        return null;
    }
    Cards.prototype.take = function(modelTaker){
        return modelTaker.take(this);
    }
    Cards.prototype.toSpecialEntity = function(EntityName){
        var cList = this.clone();
        if(!!EntityName)
            return cList.toQuickEntity(EntityName)
        //至尊清龙
        var entity =  cList.toQuickEntity(DragonFlushEntity);
        if(entity != null)
            return entity;
        //一条龙
        var entity =  cList.toQuickEntity(DragonEntity);
        if(entity != null)
            return entity;
        //十二皇族
        var entity =  cList.toQuickEntity(TwelveKingEntity);
        if(entity != null)
            return entity;
        //三同花顺
        var entity =  cList.toQuickEntity(ThreeStraightFlushEntity);
        if(entity != null)
            return entity;
        //三分天下
        var entity =  cList.toQuickEntity(ThreeBombEntity);
        if(entity != null)
            return entity;
        //全大
        var entity =  cList.toQuickEntity(AllBigEntity);
        if(entity != null)
            return entity;
        //全小
        var entity =  cList.toQuickEntity(AllSmallEntity);
        if(entity != null)
            return entity;
        //凑一色
        var entity =  cList.toQuickEntity(OneColorEntity);
        if(entity != null)
            return entity;
        //四套冲三
        var entity =  cList.toQuickEntity(FourThreeEntity);
        if(entity != null)
            return entity;
        //五对冲三
        var entity =  cList.toQuickEntity(FivePairThreeEntity);
        if(entity != null)
            return entity;
        //六对半
        var entity =  cList.toQuickEntity(SixPairEntity);
        if(entity != null)
            return entity;
        //三同花
        var entity =  cList.toQuickEntity(ThreeFlushEntity);
        if(entity != null)
            return entity;
        //三顺子
        var entity =  cList.toQuickEntity(ThreeStraightEntity);
        if(entity != null)
            return entity;
        //普通牌型
        var entity =  cList.toQuickEntity(NormalEntity);
        if(entity != null)
            return entity;

        return null;
    }
    Cards.prototype.toEntity = function(EntityName){
        var cList = this.clone();
        if(!!EntityName)
            return cList.toQuickEntity(EntityName)
        //同花顺
        var entity =  cList.toQuickEntity(StraightFlushEntity)
        if(entity != null)
            return entity;
        //炸弹
        entity =  cList.toQuickEntity(FourEntity)
        if(entity != null)
            return entity;
        //葫芦
        entity =  cList.toQuickEntity(FullHouseEntity)
        if(entity != null)
            return entity;
        //同花
        entity =  cList.toQuickEntity(FlushEntity)
        if(entity != null)
            return entity;
        //顺子
        entity =  cList.toQuickEntity(StraightEntity)
        if(entity != null)
            return entity;
        //三条
        entity =  cList.toQuickEntity(ThreeBarEntity)
        if(entity != null)
            return entity;
        //两对
        entity =  cList.toQuickEntity(TwoPairEntity)
        if(entity != null)
            return entity;
        //一对
        entity =  cList.toQuickEntity(PairEntity)
        if(entity != null)
            return entity;
        //散牌,高牌
        entity =  cList.toQuickEntity(HighEntity)
        if(entity != null)
            return entity;
        return null;
    }

    //***********************辅助实体开始*********************
    /**
     * 对子--多张牌中的数量为两张,牌值一样的牌组成的列表，注意：列表长度为2
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
        if (this.list.length != 2 || !this.existsPair()){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.pokerType = PokerType.PAIR;
        return true;
    }
    Pair.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        return this.list[0].compareTo(other.list[0]);
    }
    /**
     * 三条--多张牌中的数量为三张,牌值一样的牌组成的列表，注意：列表长度为3
     * @author glacier
     * @constructor
     */
    var Three = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.THREE;
    }
    inherits(Three,Cards);
    Three.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.list.length != 3 || !this.existsThree()){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.pokerType = PokerType.THREE;
        return true;
    }
    Three.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        return this.list[0].compareTo(other.list[0]);
    }

    /**
     * 四条--多张牌中的数量为四张,牌值一样的牌组成的列表，注意：列表长度为4
     * @author glacier
     * @constructor
     */
    var Four = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.FOUR;
    }
    inherits(Four,Cards);
    Four.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.list.length != 4 || !this.existsFour()){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.pokerType = PokerType.FOUR;
        return true;
    }
    Four.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        return this.list[0].compareTo(other.list[0]);
    }
/**
     * 顺子--多张牌中的数量为五张,从小到大相差值为一的牌组成的列表，注意：列表长度为5
     * @author glacier
     * @constructor
     */
    var Straight = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.STRAIGHT;
    }
    inherits(Straight,Cards);
    Straight.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.list.length != 5 || !this.isSequence()){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.pokerType = PokerType.STRAIGHT;
        return true;
    }
    Straight.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        return this.list[0].compareTo(other.list[0]);
    }

    /**
     * 同花--多张牌中的数量为五张,花色相同的牌组成的列表，注意：列表长度为5
     * @author glacier
     * @constructor
     */
    var Flush = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.FLUSH;
    }
    inherits(Flush,Cards);
    Flush.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.list.length != 5 || !this.isSameFlower()){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.pokerType = PokerType.FLUSH;
        return true;
    }
    Flush.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        return this.list[0].compareTo(other.list[0]);
    }

    /**
     * 同花顺--多张牌中的数量为五张,从小到大相差值为一并且花色相同的牌组成的列表，注意：列表长度为5
     * @author glacier
     * @constructor
     */
    var StraightFlush = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.STRAIGHT_FLUSH;
    }
    inherits(StraightFlush,Cards);
    StraightFlush.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.list.length != 5 || !this.isSameFlower() || !this.isSequence()){
            this.pokerType = PokerType.NULL;
            return false;
        }
        this.pokerType = PokerType.STRAIGHT_FLUSH;
        return true;
    }
    StraightFlush.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        return this.list[0].compareTo(other.list[0]);
    }
    //***********************辅助实体结束*********************
    //***********************辅助实体提取开始*********************
    var SingleTaker = function() {

    }
    SingleTaker.take = function(cards) {
        if(!cards || cards.list.length <= 0)
            return null;
        var cList = cards;
        if(!cards.order || cards.order === Order.NULL){
            var cList = cards.clone();
            cList.sort();
        }
        var singleList = [];
        if (cList.list[0].value != cList.list[1].value) {
            var single = new Cards();
            single.push(cList.list[0]);
            singleList.push(single);
            single.checked = true;
        }
        for (var i=1;i<cList.list.length-1;i++) {
            var card1 = cList.list[i-1];
            var card2 = cList.list[i];
            var card3 = cList.list[i+1];
            if (card1.value != card2.value && card2.value != card3.value) {
                var single = new Cards();
                single.push(card2);
                singleList.push(single);
                single.checked = true;
            }
        }
        if (cList.list[cList.list.length-2].value != cList.list[cList.list.length-1].value) {
            var single = new Cards();
            single.push(cList.list[cList.list.length-1]);
            singleList.push(single);
            single.checked = true;
        }
        if (singleList.length > 0)
            return singleList;
        return null;
    } 
    /**
     * 对子提取器，提取对子列表，列表中的数据全为对子
     * @author glacier
     * @constructor
     */
    var PairTaker = function() {
    }
    /**
     * 从多张牌列表中提取对子，组成列表
     * @param cardLisBase
     * @returns {*}
     */
    PairTaker.take = function(cards) {
        if(!cards || cards.list.length < 2)
            return null;
        var cList = cards;
        if(!cards.order || cards.order === Order.NULL){
            var cList = cards.clone();
            cList.sort();
        }
        var pairList =[];
        var size = cList.list.length;
        for (var i = 0; i <= size - 2; i++) {
            var card1 = cList.list[i];
            var card2 = cList.list[i + 1];
            if (card1.value === card2.value)  {
                var pair = new Pair();
                pair.push(card1);
                pair.push(card2);
                pairList.push(pair);
                pair.checked = true;
                i++;
            }
        }
        if (pairList.length > 0)
            return pairList;
        return null;
    }
    //
    var ThreeTaker = function() {
    }

    ThreeTaker.take = function(cards) {
        if(!cards || cards.list.length < 3)
            return null;
        var cList = cards;
        if(!cards.order || cards.order === Order.NULL){
            var cList = cards.clone();
            cList.sort();
        }
        var threeList =[];
        for (var i = 0; i <= cList.list.length - 3; i++) {
            var card1 = cList.list[i];
            var card2 = cList.list[i + 1];
            var card3 = cList.list[i + 2];
            if (card1.value === card2.value && card2.value === card3.value) {
                var three = new Three();
                three.push(card1);
                three.push(card2);
                three.push(card3);
                threeList.push(three);
                three.checked = true;
                i += 2;
            }
        }
        if (threeList.length > 0)
            return threeList;
        return null;
    }

    var FourTaker = function() {
    }

    FourTaker.take = function(cards) {
        if (!cards || cards.list.length < 4)
            return null;
        var cList = cards;
        if(!cards.order || cards.order === Order.NULL){
            var cList = cards.clone();
            cList.sort();
        }
        var fourList = [];
        for (var i = 0; i <= cList.list.length - 4; i++) {
            var card1 = cList.list[i];
            var card2 = cList.list[i + 1];
            var card3 = cList.list[i + 2];
            var card4 = cList.list[i + 3];
            if (card1.value === card2.value && card2.value === card3.value && card3.value === card4.value) {
                var four = new Four();
                four.push(card1);
                four.push(card2);
                four.push(card3);
                four.push(card4);
                fourList.push(four);
                four.checked = true;
                i += 3;
            }
        }
        if (fourList.length > 0)
            return fourList;
        return null;
    }



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
     * 单张列表：列表中所有项都是单张
     * @constructor
     */
    var SingleModel = function(list){
        this.pokerType = PokerType.SINGLE;
        ModelBase.call(this,list);
    }
    inherits(SingleModel,ModelBase);
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
            if (pairSequence.size < 6)
                pairSequenceModel.remove(pairSequence);
        }
        return pairSequenceModel;
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
     * 炸弹列表
     * @constructor
     */
    var BombModel = function(){
        this.pokerType = PokerType.BOMB;
        ModelBase.call(this);
    }
    inherits(BombModel,ModelBase);


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



    var FlushEntityTaker = function() {
    }
    FlushEntityTaker.take = function(cards) {
        var flushList = [new Cards(),new Cards(),new Cards(),new Cards()];
        cards.list.forEach(function(card){
            flushList[card.type - 1].add(card);
        });
        return flushList.filter(function(cardList){ return cardList.size > 0; });
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

        if (!this.isSequence())
            return false;
        this.sort();
        var minCardValue = this.list[0].value;
        if(minCardValue < 2 || minCardValue > 10){
            return false;
        }
        var maxCardValue = this.list[this.size - 1].value;
        if(maxCardValue < 5 || maxCardValue > 14){
            return false;
        }
        return true;
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
     * 单顺列表
     * @constructor
     */
    var SingleSequenceModel = function(){
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
     * 单顺5张牌提取器
     * @constructor
     */
    var FiveSingleSequenceTaker = function() {
    }

    var findFiveSequenceByValue = function(cardList,cardValue) {
        if (!cardList.existsFiveSequence(cardValue)){
            return null;
        }
        var singleSequence = new SingleSequence();

        if(cardValue == 14){
            for (var i = 2; i < 6; i++) {
                var iCardValue =  i;
                var card = cardList.findByValue(iCardValue);
                singleSequence.add(card);
            }
            return singleSequence;
        }

        for (var i = 0; i < 5; i++)  {
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
     * 单顺模型提取器
     * @constructor
     */
    var SingleSequenceTaker = function(){
    }
    var addCardListToSequenceList = function(singleSequenceList, cardList){
        var newFiveCardList = cardList.clone();
        for(var i=0;i<newFiveCardList.size;i++){
            var card = newFiveCardList.list[i];
            for (var j = 0; j < singleSequenceList.size; j++) {
                var fiveCardList = singleSequenceList.list[j].clone();
                fiveCardList.add(card);
                //判断是否是顺子
                if (fiveCardList.isSequence())  {
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
    
    
     var StraightTaker = function() {
    }

    StraightTaker.take = function(cards) {
        if (!cards || cards.list.length < 5)
            return null;
        var cList = cards;
        if(!cards.order || cards.order === Order.NULL){
            var cList = cards.clone();
            cList.sort();
        }
        var straightList = [];
        for (var i=0; i<= cList.list.length - 5;i++) {
            var card = cList.list[i];
            var straight = new Straight();
            straight.push(card);
            for (var ii=1;ii<5;ii++) {
                var cardNext = cList.findByValue(card.value+ii);
                if (cardNext) {
                    straight.push(cardNext);
                }
            }
            if (straight.list.length == 5) {
                straightList.push(straight);
                straight.checked = true;
            }
        }
        //A-5的顺子 单独处理
        for (var i=1;i<5;i++) {
            var card = cList.list[cList.list.length-i];
            var straight = new Straight();
            if (card.value == 14) {
                var card1 = cList.findByValue(2);
                var card2 = cList.findByValue(3);
                var card3 = cList.findByValue(4);
                var card4 = cList.findByValue(5);
                if (!!card1 && !!card2 && !!card3 && !!card4) {
                    straight.push(card);
                    straight.push(card1);
                    straight.push(card2);
                    straight.push(card3);
                    straight.push(card4);
                    straightList.push(straight);
                    straight.checked = true;
                }
            }
        }
        if (straightList.length > 0)
            return straightList;
        return null;
    }

    var FlushTaker = function() {
    }

    FlushTaker.take = function(cards) {
        if (!cards || cards.list.length < 5)
            return null;
        var cList = cards;
        if(!cards.order || cards.order === Order.NULL){
            var cList = cards.clone();
            cList.sort();
        }
        var flushList = [];
        var flushFlowerList = [new Cards(),new Cards(),new Cards(),new Cards()];
        cList.list.forEach(function(card){
            flushFlowerList[card.type - 1].add(card);
        });
        var result = [];
        var count = 5;
        var func = function(arr,result,start,count,length) {
            for (var i=start;i<length+1-count;i++) {
                result[count-1] = i;
                if (count-1==0) {
                    var flush = new Flush();
                    for (var ii=4;ii>=0;ii--) {
                        flush.push(arr[result[ii]]);
                    }
                    flushList.push(flush);
                    flush.checked = true;
                }else {
                    func(arr,result,i+1,count-1,length);
                }
            }
        }
        for (var i=0;i<flushFlowerList.length;i++) {
            if (flushFlowerList[i].list.length >= 5) {
                func(flushFlowerList[i].list,result,0,count,flushFlowerList[i].list.length);
            }
        }
        if (flushList.length > 0)
            return flushList;
        return null;
    }

    var StraightFlushTaker = function() {
    }

    StraightFlushTaker.take = function(cards) {
        if (!cards || cards.list.length < 5)
            return null;
        var cList = cards;
        if(!cards.order || cards.order === Order.NULL){
            var cList = cards.clone();
            cList.sort();
        }
        var straightFlushList = [];
        var flushFlowerList = FlushTaker.take(cards);
        if (flushFlowerList && flushFlowerList.length > 0) {
            for (var i=0;i<flushFlowerList.length;i++) {
                for (var ii=0;ii<=flushFlowerList[i].list.length-5;ii++) {
                    var card1 = flushFlowerList[i].list[ii];
                    var card2 = flushFlowerList[i].list[ii + 1];
                    var card3 = flushFlowerList[i].list[ii + 2];
                    var card4 = flushFlowerList[i].list[ii + 3];
                    var card5 = flushFlowerList[i].list[ii + 4];
                    if ((card5.value - card4.value == 1 && card4.value - card3.value == 1 && card3.value - card2.value == 1 && card2.value - card1.value == 1)||(card5.value == 14 && card4.value == 5 && card3.value == 4 && card2.value == 3 && card1.value == 2)) {
                        var straightFlush = new StraightFlush();
                        straightFlush.push(card1);
                        straightFlush.push(card2);
                        straightFlush.push(card3);
                        straightFlush.push(card4);
                        straightFlush.push(card5);
                        straightFlushList.push(straightFlush);
                        straightFlush.checked = true;
                    }
                }
            }
        }
        if (straightFlushList.length > 0)
            return straightFlushList;
        return null;
    }
    //***********************辅助实体提取结束*********************
    //***********************EntityBegin*********************
    var StraightFlushEntity = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.STRAIGHT_FLUSH;
        this.water = 5;
    }

    inherits(StraightFlushEntity,Cards);

    StraightFlushEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if(this.size != 5){
            return false;
        }
        if (this.isSameFlower() && this.isSequence())  {
            this.pokerType = PokerType.STRAIGHT_FLUSH;
            return true;
        }
        this.pokerType = PokerType.NULL;
        return false;
    }
    StraightFlushEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        this.sort();
        other.sort();
        //if(this.list[0].value==2&&this.list[1].value==3&&this.list[2].value==4
        //    &&this.list[3].value==5&&this.list[4].value==14){
        //    if(other.list[0].value==2&&other.list[1].value==3&&other.list[2].value==4
        //        &&other.list[3].value==5&&other.list[4].value==14){
        //        return 0;
        //    }
        //    return -1;
        //} else if(other.list[0].value==2&&other.list[1].value==3&&other.list[2].value==4
        //    &&other.list[3].value==5&&other.list[4].value==14){
        //    return 1;
        //}
        var thisHigh = this.toQuickEntity(HighEntity);
        var otherHigh = other.toQuickEntity(HighEntity);
        return thisHigh.compareTo(otherHigh);
    }
    var FourEntity = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.FOUR;
        this.water = 4;
    }

    inherits(FourEntity,Cards);
    FourEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if(this.size != 5){
            return false;
        }
        if (this.findFourNumber() == 1){
            this.pokerType = PokerType.FOUR;
            return true;
        }
        this.pokerType = PokerType.NULL;
        return false;
    }
    FourEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        var thisFourList = FourTaker.take(this);
        var otherFourList = FourTaker.take(other);
        return thisFourList[0].list[0].compareTo(otherFourList[0].list[0]);
    }

    var FullHouseEntity = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.FULL_HOUSE;
        this.water = 1;
    }

    inherits(FullHouseEntity,Cards);
    FullHouseEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if(this.size != 5){
            return false;
        }
        if (this.findPairNumber() == 2 && this.existsThree() && !this.existsFour()){
            this.pokerType = PokerType.FULL_HOUSE;
            return true;
        }
        this.pokerType = PokerType.NULL;
        return false;
    }
    FullHouseEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        var thisThreeList = ThreeTaker.take(this);
        var otherThreeList = ThreeTaker.take(other);
        return thisThreeList[0].list[0].compareTo(otherThreeList[0].list[0]);

    }
    var FlushEntity = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.FLUSH;
        this.water = 1;
    }
    inherits(FlushEntity,Cards);
    FlushEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if(this.size != 5){
            return false;
        }
        if (this.isSameFlower()){
            this.pokerType = PokerType.FLUSH;
            return true;
        }
        this.pokerType = PokerType.NULL;
        return false;
    }
    FlushEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        var thisHigh = this.toQuickEntity(HighEntity);
        var otherHigh = other.toQuickEntity(HighEntity);
        return thisHigh.compareTo(otherHigh);
    }

    var StraightEntity = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.STRAIGHT;
        this.water = 1;
    }
    inherits(StraightEntity,Cards);
    StraightEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if(this.size != 5){
            return false;
        }
        if (this.isSequence()){
            this.pokerType = PokerType.STRAIGHT;
            return true;
        }
        this.pokerType = PokerType.NULL;
        return false;
    }
    StraightEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        this.sort();
        other.sort();
        //if(this.list[0].value==2&&this.list[1].value==3&&this.list[2].value==4
        //    &&this.list[3].value==5&&this.list[4].value==14){
        //    if(other.list[0].value==2&&other.list[1].value==3&&other.list[2].value==4
        //        &&other.list[3].value==5&&other.list[4].value==14){
        //        return 0;
        //    }
        //    return -1;
        //} else if(other.list[0].value==2&&other.list[1].value==3&&other.list[2].value==4
        //    &&other.list[3].value==5&&other.list[4].value==14){
        //    return 1;
        //}
        var thisHigh = this.toQuickEntity(HighEntity);
        var otherHigh = other.toQuickEntity(HighEntity);
        return thisHigh.compareTo(otherHigh);
    }

    var ThreeBarEntity = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.THREE;
        this.water = 1;
    }
    inherits(ThreeBarEntity,Cards);
    ThreeBarEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.findThreeNumber() == 1){
            this.pokerType = PokerType.THREE;
            if(this.size == 3){
                this.water = 3;
            }
            return true;
        }
        this.pokerType = PokerType.NULL;
        return false;
    }
    ThreeBarEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        var thisThreeList = ThreeTaker.take(this);
        var otherThreeList = ThreeTaker.take(other);

        if(thisThreeList[0].list[0].compareTo(otherThreeList[0].list[0]) !=0)
            return thisThreeList[0].list[0].compareTo(otherThreeList[0].list[0]);

        var thisHigh = this.toQuickEntity(HighEntity);
        var otherHigh = other.toQuickEntity(HighEntity);
        return thisHigh.compareTo(otherHigh);
    }

    var TwoPairEntity = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.TWO_PAIR;
        this.water = 1;
    }
    inherits(TwoPairEntity,Cards);
    TwoPairEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if(this.size != 5){
            return false;
        }
        if (this.findPairNumber() == 2){
            this.pokerType = PokerType.TWO_PAIR;
            return true;
        }
        this.pokerType = PokerType.NULL;
        return false;
    }
    TwoPairEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        var thisPairList = PairTaker.take(this);
        var otherPairList = PairTaker.take(other);
        thisPairList.sort(function(pair1,pair2){
            return pair1.compareTo(pair2);
        });
        otherPairList.sort(function(pair1,pair2){
            return pair1.compareTo(pair2);
        });
        if (thisPairList[1].list[0].compareTo(otherPairList[1].list[0]) != 0)
            return thisPairList[1].list[0].compareTo(otherPairList[1].list[0]);

        if (thisPairList[0].list[0].compareTo(otherPairList[0].list[0]) != 0)
            return thisPairList[0].list[0].compareTo(otherPairList[0].list[0]);
        var thisHigh = this.toQuickEntity(HighEntity);
        var otherHigh = other.toQuickEntity(HighEntity);
        return thisHigh.compareTo(otherHigh);
    }
    var PairEntity = function(){
        Cards.apply(this,arguments);
        this.water = 1;
        this.pokerType = PokerType.PAIR;
    }
    inherits(PairEntity,Cards);
    PairEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        if (this.findPairNumber() >= 1){
            this.pokerType = PokerType.PAIR;
            return true;
        }
        this.pokerType = PokerType.NULL;
        return false;
    }
    PairEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        var thisPairList = PairTaker.take(this);
        var otherPairList = PairTaker.take(other);
        thisPairList.sort(function (pair1,pair2){
            return pair2.compareTo(pair1);
        });
        otherPairList.sort(function (pair1,pair2){
            return pair2.compareTo(pair1);
        });
        var thisPair = thisPairList[0];
        var otherPair = otherPairList[0];
        if (thisPair.list[0].compareTo(otherPair.list[0]) != 0)
            return thisPair.list[0].compareTo(otherPair.list[0]);
        var thisHigh = this.toQuickEntity(HighEntity);
        var otherHigh = other.toQuickEntity(HighEntity);
        return thisHigh.compareTo(otherHigh);
    }

    var HighEntity = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.HIGH;
        this.water = 1;
    }
    inherits(HighEntity,Cards);
    HighEntity.prototype.check = function() {
        if(!Cards.prototype.check.call(this))
            return false;
        this.pokerType = PokerType.HIGH;
        return true;
    }
    HighEntity.prototype.compareTo = function(other) {
        var i = Cards.prototype.compareTo.call(this,other);
        if (i !== 0)
            return i;
        var thisList = this.reverse();
        var otherList = other.reverse();

        var size = thisList.list.length;
        if (otherList.list.length < thisList.list.length)
            size = otherList.list.length;
        if(size <= 0)
            throw TypeError('list is empty')
        for (var i = 0; i < size; i++) {
            if (thisList.list[i].compareTo(otherList.list[i]) != 0)
                return thisList.list[i].compareTo(otherList.list[i]);
        }
        return 0;
    }

    //***********************EntityEnd*********************

    //***********************SpecialCards*********************
    var SpecialCards = function(){
        Cards.apply(this,arguments);
        this.pokerType = PokerType.NULL;
        this.specialPokerType = SpecialPokerType.NULL;
        this.entity1 = null;
        this.entity2 = null;
        this.entity3 = null;
    }
    inherits(SpecialCards,Cards);

    SpecialCards.prototype.check = function() {
        if (this.list.length != 13){
            //throw new Error("the number of cards is not 13")
            this.specialPokerType = SpecialPokerType.NULL;
            return false;
        }

        var list1 = new Cards([this.list[0],this.list[1],this.list[2]]);//第一墩
        var list2 = new Cards([this.list[3],this.list[4],this.list[5],this.list[6],this.list[7]]);//第二墩
        var list3 = new Cards([this.list[8],this.list[9],this.list[10],this.list[11],this.list[12]]);//第三墩
        this.entity1 = list1.toEntity();
        this.entity2 = list2.toEntity();
        this.entity3 = list3.toEntity();
        //if(!this.entity1 || !this.entity2 || !this.entity3){
        //    return false;
        //}
        //if(this.specialPokerType <= SpecialPokerType.NORMAL){
        //    if(this.entity1.compareTo(this.entity2) > 0 || this.entity2.compareTo(this.entity3) > 0 || this.entity1.compareTo(this.entity3) > 0){
        //        return false;
        //    }
        //}
        //if (this.entity2.pokerType == PokerType.FULL_HOUSE){
        //    this.entity2.water = 2;
        //} else if (this.entity2.pokerType == PokerType.FOUR){
        //    this.entity2.water = 8;
        //} else if (this.entity2.pokerType >= PokerType.STRAIGHT_FLUSH){
        //    this.entity2.water = 10;
        //}
        this.checked = true;
        return true;
    }
    SpecialCards.prototype.compareTo = function(other) {
        if(!other)
            throw TypeError('other is null or undefined');
        if (this.list.length != 13 ){
            throw TypeError("two cards's length must be between 1 and 5");
        }
        if(!this.checked){
            throw TypeError("it must not be checked,"+this.toString());
        }
        if(this.specialPokerType == SpecialPokerType.NULL){
            throw TypeError("this cards must not be Entity,please invoke toEntity function,"+this.toString());
        }
        if(other.specialPokerType == SpecialPokerType.NULL){
            throw TypeError("the other cards must not be Entity,please invoke toEntity function"+other.toString());
        }
        if(this.specialPokerType > other.specialPokerType)
            return 1;
        else  if(this.specialPokerType < other.specialPokerType)
            return -1;
        else
            return 0;
    }
    //***********************SpecialCards*********************
//***********************SpecialEntityBegin*********************
    /**
     * 同花十三水（至尊清龙） 同花一至十三的牌型！（原108水）
     * 修改日期:2017-02-24
     * 修改内容:216水
     * 修改日期:2017-03-20
     * 修改内容:108,216可选
     * @constructor
     */
    var DragonFlushEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.DRAGON_FLUSH;
        this.water2 = 108;
        this.water = 108;
    }
    inherits(DragonFlushEntity,SpecialCards);
    DragonFlushEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        if (this.isSameFlower() && this.isSequence() && this.size == 13)  {
            this.specialPokerType = SpecialPokerType.DRAGON_FLUSH;
            return true;
        }
        return false;
    }
    DragonFlushEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 一条龙:不同花色从A到K的牌,36水
     * 修改日期:2017-02-24
     * 修改内容:72水
     * @constructor
     */
    var DragonEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.DRAGON;
        this.water2 = 36;
        this.water = 36;
    }
    inherits(DragonEntity,SpecialCards);
    DragonEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        if (this.isSequence() && this.size == 13)  {
            this.specialPokerType = SpecialPokerType.DRAGON;
            return true;
        }
        return false;
    }
    DragonEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 十二皇族:全部为JQKA的牌,24水
     * 修改日期:2017-02-24
     * 修改内容:48水
     * @constructor
     */
    var TwelveKingEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.TWELVE_KING;
        this.water2 = 48;
        this.water = 24;
    }
    inherits(TwelveKingEntity,SpecialCards);
    TwelveKingEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        var every = this.list.every(function(card){
            return card.value > 10;
        });
        if (every)  {
            this.specialPokerType = SpecialPokerType.TWELVE_KING;
            return true;
        }
        return false;
    }
    TwelveKingEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 三同花顺：每一墩都为同花顺的牌,22水
     * 修改日期:2017-02-24
     * 修改内容:40水
     * @constructor
     */
    var ThreeStraightFlushEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.THREE_STRAIGHT_FLUSH;
        this.water2 = 40;
        this.water = 22;
    }
    inherits(ThreeStraightFlushEntity,SpecialCards);
    ThreeStraightFlushEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        this.checked = true;
        var list = FlushEntityTaker.take(this);
        if(list.length == 3){
            if(!list[0].isSequence() || !list[1].isSequence() || !list[2].isSequence()){
                return false;
            }
            //有三条
            var threeBarList = list.filter(function(cards){
                return cards.size == 3;
            });
            var fiveBarList = list.filter(function(cards){
                return cards.size == 5;
            });
            if(!!threeBarList && threeBarList.length == 1 && !!fiveBarList && fiveBarList.length == 2) {
                this.specialPokerType = SpecialPokerType.THREE_STRAIGHT_FLUSH;
                return true;
            }
        }
        else if(list.length == 2){
            list.sort(function(c1,c2){
                return c1.size - c2.size;
            });
            if (list[0].size == 3 || list[0].size == 5) {
                if(!list[0].isSequence()) {
                    return false;
                }
                var cs = list[1].clone();
                cs.sort();
                var myCards1 = new Cards();
                var startValue = cs.list[0].value;
                var hasStart = false;
                while (cs.size > 0) {
                    if (!cs.exists(startValue)) {
                        break;
                    }
                    var c = cs.findByValue(startValue);
                    myCards1.push(c);
                    cs.remove(c);
                    if (myCards1.size >= 5) {
                        break;
                    }
                    if (cs.exists(startValue)) {
                        hasStart = true;
                    }
                    else {
                        // push进去的移出来
                        if (hasStart) {
                            myCards1.remove(c);
                            cs.push(c);
                            break;
                        }
                    }
                    startValue += 1;
                }
                if (myCards1.size != 3 && myCards1.size != 5) {
                    myCards1.push(cs.list[cs.size-1]);
                    cs.remove(cs.list[cs.size-1]);
                }
                if (!myCards1.isSequence() || !cs.isSequence()) {
                    return false;
                }
                if (myCards1.size != 5 && myCards1.size != 3) {
                    return false;
                }
                if (cs.size != 5 && cs.size != 3) {
                    return false;
                }
                this.specialPokerType = SpecialPokerType.THREE_STRAIGHT_FLUSH;
                return true;
            }
            else {
                return false;
            }
        }
        else if(list.length == 1){
            for (var i = 0; i < 3; i++) {
                var cs = list[0].clone();
                cs.sort();
                var myCardsArr = [new Cards(), new Cards(), new Cards()];
                var maxArr = [5, 5, 5];
                maxArr[i] = 3;
                var startValue = cs.list[0].value;
                var curIndex = 0;
                while (cs.size > 0) {
                    if (curIndex >= 3) {
                        break;
                    }
                    if (!cs.exists(startValue)) {
                        break;
                    }
                    var needReset = false;

                    if (myCardsArr[curIndex].size != maxArr[curIndex]) {
                        var c = cs.findByValue(startValue);
                        myCardsArr[curIndex].push(c);
                        cs.remove(c);
                        if (myCardsArr[curIndex].size == maxArr[curIndex]) {
                            needReset = true;
                        }
                    }
                    if (cs.size > 0) {
                        if (needReset) {
                            startValue = cs.list[0].value;
                            curIndex++;
                        }
                        else {
                            startValue++;
                            if (!cs.exists(startValue)) {
                                startValue = cs.list[0].value;
                                curIndex++;
                            }
                        }
                    }
                    // A做特殊处理
                    if (startValue == CardValue.A && cs.size > 0) {
                        for (var j = cs.size-1; j >= 0; j--) {
                            for (var k = 0; k < 3; k++) {
                                if (myCardsArr[k].size != maxArr[k]) {
                                    myCardsArr[k].push(cs.list[j]);
                                    cs.remove(cs.list[j]);
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }
                // 全部取完
                if (cs.size == 0) {
                    if (myCardsArr[0].isSequence() && myCardsArr[1].isSequence() && myCardsArr[2].isSequence()) {
                        this.specialPokerType = SpecialPokerType.THREE_STRAIGHT_FLUSH;
                        return true;
                    }
                }
            }
            return false;
        }

        return false;
        //if(this.entity1.pokerType == PokerType.STRAIGHT_FLUSH
        //    && this.entity2.pokerType == PokerType.STRAIGHT_FLUSH
        //    && this.entity3.pokerType == PokerType.STRAIGHT_FLUSH){
        //    this.specialPokerType = SpecialPokerType.THREE_STRAIGHT_FLUSH
        //    return true;
        //}
        //return false;
    }
    ThreeStraightFlushEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }



    /**
     * 三分天下：3组铁支+1张单牌,20水
     * 修改日期:2017-02-24
     * 修改内容:40水
     * @constructor
     */
    var ThreeBombEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.THREE_BOMB;
        this.water2 = 40;
        this.water = 20;
    }
    inherits(ThreeBombEntity,SpecialCards);
    ThreeBombEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;

        if (this.findFourNumber() == 3) {
            this.specialPokerType = SpecialPokerType.THREE_BOMB;
            return true;
        }
        else {
            return false;
        }
    }
    ThreeBombEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 全大：全部为8到A的牌,15水
     * 修改日期:2017-02-24
     * 修改内容:20水
     * @constructor
     */
    var AllBigEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.ALL_BIG;
        this.water2 = 20;
        this.water = 15;
    }
    inherits(AllBigEntity,SpecialCards);
    AllBigEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        var every = this.list.every(function(card){
            return card.value >= 8 && card.value <=14;
        });
        if (every)  {
            this.specialPokerType = SpecialPokerType.ALL_BIG;
            return true;
        }

        return false;
    }
    AllBigEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }
    /**
     * 全小：全部为2到8的牌,12水
     * 修改日期:2017-02-24
     * 修改内容:20水
     * @constructor
     */
    var AllSmallEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.ALL_SMALL;
        this.water2 = 20;
        this.water = 12;
    }
    inherits(AllSmallEntity,SpecialCards);
    AllSmallEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        var every = this.list.every(function(card){
            return card.value >= 2 && card.value <=8;
        });
        if (every)  {
            this.specialPokerType = SpecialPokerType.ALL_SMALL;
            return true;
        }
        return false;
    }
    AllSmallEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }


    /**
     * 凑一色：全部为黑桃梅花或者红心方块的牌,10水
     * 修改日期:2017-02-24
     * 修改内容:20水
     * @constructor
     */
    var OneColorEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.FLUSH;
        this.water2 = 20;
        this.water = 10;
    }
    inherits(OneColorEntity,SpecialCards);
    OneColorEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        var every1 = this.list.every(function(card){
            return card.type == CardType.HEART || card.type == CardType.DIAMOND//红桃 方块
        });
        var every2 = this.list.every(function(card){
            return card.type == CardType.SPADE || card.type == CardType.CLUB//黑桃 梅花
        });
        if (every1 || every2)  {
            this.specialPokerType = SpecialPokerType.FLUSH;
            return true;
        }
        return false;
    }
    OneColorEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 四套冲三：4组三条+1张单牌,6水
     * 修改日期:2017-02-24
     * 修改内容:12水
     * @constructor
     */
    var FourThreeEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.FOUR_THREE;
        this.water2 = 12;
        this.water = 6;
    }
    inherits(FourThreeEntity,SpecialCards);
    FourThreeEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        if(this.findFourNumber() == 4){
            this.specialPokerType = SpecialPokerType.FOUR_THREE;
            return true;
        }

        return false;
    }
    FourThreeEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 五对冲三：5组对子+1一个三条,5水
     * 修改日期:2017-02-24
     * 修改内容:10水
     * @constructor
     */
    var FivePairThreeEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.FIVE_PAIR_THREE;
        this.water2 = 10;
        this.water = 5;
    }
    inherits(FivePairThreeEntity,SpecialCards);
    FivePairThreeEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        if(this.findPairNumber() == 6 && this.existsThree()){
            this.specialPokerType = SpecialPokerType.FIVE_PAIR_THREE;
            return true;
        }

        return false;
    }
    FivePairThreeEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 六对半：6组对子+1张单牌,4水
     * 修改日期:2017-02-24
     * 修改内容:6水
     * @constructor
     */
    var SixPairEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.SIX_PAIR;
        this.water2 = 6;
        this.water = 4;
    }
    inherits(SixPairEntity,SpecialCards);
    SixPairEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        if(this.findPairNumber() == 6){
            this.specialPokerType = SpecialPokerType.SIX_PAIR;
            return true;
        }

        return false;
    }
    SixPairEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 三同花：每墩都是同花的牌,3水
     * 修改日期:2017-02-24
     * 修改内容:6水
     * @constructor
     */
    var ThreeFlushEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.THREE_FLUSH;
        this.water2 = 6;
        this.water = 3;
    }
    inherits(ThreeFlushEntity,SpecialCards);
    ThreeFlushEntity.prototype.check = function() {
        this.checked = true;
        if(!SpecialCards.prototype.check.call(this))
            return false;
        var list = FlushEntityTaker.take(this);
        if(list.length != 3 && list.length != 2){
            return false;
        }
        var newList = [];
        list.forEach(function(cards){
            cards.sort();
            if(cards.size > 5){
                var l1 = cards.list.slice(0,5);
                var cList1 = new Cards(l1);
                newList.push(cList1);
                var l2 = cards.list.slice(5);
                var cList2 = new Cards(l2);
                newList.push(cList2);
            } else {
                newList.push(cards);
            }
        });
        if(newList.length != 3){
            return false;
        }
        newList.forEach(function(item){
            if(item.size != 3 && item.size != 5){
                return false;
            }
        });


        //有三条
        var threeBarList = newList.filter(function(cards){
            return cards.size == 3;
        });
        if(!threeBarList || threeBarList.length != 1){
            return false;
        }
        //var cList = this.clone();
        //cList.removeList(threeBarList[0]);
        //this.removeList(cList);
        //this.addList(cList);

        //if(!SpecialCards.prototype.check.call(this))
        //    return false;
        //if(this.entity1.pokerType == PokerType.FLUSH
        //    && this.entity2.pokerType == PokerType.FLUSH
        //    && this.entity3.pokerType == PokerType.FLUSH){
        //    this.specialPokerType = SpecialPokerType.THREE_FLUSH;
        //    return true;
        //}
        this.specialPokerType = SpecialPokerType.THREE_FLUSH;
        return true;
        //return false;
    }
    ThreeFlushEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }


    /**
     * 三顺子：每墩都是顺子的牌,3水
     * 修改日期:2017-02-24
     * 修改内容:6水
     * @constructor
     */
    var ThreeStraightEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.THREE_STRAIGHT;
        this.water2 = 6;
        this.water = 3;
    }
    inherits(ThreeStraightEntity,SpecialCards);
    ThreeStraightEntity.prototype.checkEntity = function() {
        var list = this.getDistinctList();
        for(var i=0;i<=list.length - 3;i++){
            var list1 = [];
            list1.push(list[i]);
            list1.push(list[i+1]);
            list1.push(list[i+2]);
            var cards1 = new Cards(list1);
            if(cards1.isSequence()){//第一墩是顺子,将余下的牌组成五顺
                var newCards = this.clone();
                newCards.removeList(cards1);
                var newList = newCards.getDistinctList();
                for(var j=0;j<=newList.length - 5;j++){
                    var list2 = [];
                    list2.push(newList[j]);
                    list2.push(newList[j+1]);
                    list2.push(newList[j+2]);
                    list2.push(newList[j+3]);
                    list2.push(newList[j+4]);
                    var cards2 = new Cards(list2);
                    if(cards2.isSequence()) {//第二墩是顺子
                        var otherCards = newCards.clone();
                        otherCards.removeList(cards2);
                        if(otherCards.isSequence()) {//第三墩是顺子
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    ThreeStraightEntity.prototype.check = function() {
        if(!SpecialCards.prototype.check.call(this))
            return false;
        this.checked = true;
        var other = this.clone();
        other.sort();
        if(other.exists(poker.CardValue.A)){
            var flag = other.checkEntity();
            if(flag){
                this.specialPokerType = SpecialPokerType.THREE_STRAIGHT;
                return true;
            }
            var otherA = other.clone();
            var cardA = otherA.pop();
            otherA.unshift(cardA);
            var flag = otherA.checkEntity();
            if(flag){
                this.specialPokerType = SpecialPokerType.THREE_STRAIGHT;
                return true;
            }

        } else {
            var flag = other.checkEntity();
            if(flag){
                this.specialPokerType = SpecialPokerType.THREE_STRAIGHT;
                return true;
            }
        }
        this.specialPokerType = SpecialPokerType.NULL;
        return false;
    }

    ThreeStraightEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }

    /**
     * 普通13张：不是特殊牌型,0水,不排序
     * @constructor
     */
    var NormalEntity = function(){
        SpecialCards.apply(this,arguments);
        this.specialPokerType = SpecialPokerType.NORMAL;
        this.water = 0;
    }
    inherits(NormalEntity,SpecialCards);
    NormalEntity.prototype.check = function() {
        //if(!SpecialCards.prototype.check.call(this))
        //    return false;
        //
        //return true;
        this.checked = true;
        if (this.list.length != 13){
            this.specialPokerType = SpecialPokerType.NULL;
            return false;
        }

        var list1 = new Cards([this.list[0],this.list[1],this.list[2]]);//第一墩
        var list2 = new Cards([this.list[3],this.list[4],this.list[5],this.list[6],this.list[7]]);//第二墩
        var list3 = new Cards([this.list[8],this.list[9],this.list[10],this.list[11],this.list[12]]);//第三墩
        this.entity1 = list1.toEntity();
        this.entity2 = list2.toEntity();
        this.entity3 = list3.toEntity();
        if(!this.entity1 || !this.entity2 || !this.entity3){
            return false;
        }
        if(this.specialPokerType <= SpecialPokerType.NORMAL){
            if(this.entity1.compareTo(this.entity2) > 0 || this.entity2.compareTo(this.entity3) > 0 || this.entity1.compareTo(this.entity3) > 0){
                return false;
            }
        }
        if (this.entity2.pokerType == PokerType.FULL_HOUSE){
            this.entity2.water = 2;
        } else if (this.entity2.pokerType == PokerType.FOUR){
            this.entity2.water = 8;
        } else if (this.entity2.pokerType >= PokerType.STRAIGHT_FLUSH){
            this.entity2.water = 10;
        }
        this.checked = true;
        return true;
    }
    NormalEntity.prototype.compareTo = function(other) {
        var i = SpecialCards.prototype.compareTo.call(this,other);
        return i;
    }
    //***********************SpecialEntityEnd***********************



    //***********************提取器开始********************************
    /**
     * 单张提取器:从牌列表中提取所有单张进行组合
     * @constructor
     */
    //var SingleTaker = function(){
    //}
    //SingleTaker.prototype.take = function(cardList){
    //    if (!cardList || cardList.size < 1)
    //        return null;
    //    cardList.sort();
    //    var singleList = new SingleModel();
    //    for(var i=0;i<cardList.size;i++){
    //        var card = cardList.list[i];
    //        var single = new Single();
    //        single.add(card);
    //        singleList.add(single);
    //    }
    //    if (singleList!=null && singleList.size > 0)
    //        return singleList;
    //    return null;
    //
    //}
    ///**
    // * 对子提取器
    // * @constructor
    // */
    //var PairTaker = function() {
    //}
    //PairTaker.prototype.take = function(cardList) {
    //    if(!cardList || cardList.size < 2){
    //        return null;
    //    }
    //    cardList.sort();
    //    var pairList = new PairModel();
    //    for (var i = 0; i <= cardList.size - 2; i++) {
    //        var card1 = cardList.list[i];
    //        var card2 = cardList.list[i + 1];
    //        if (card1.value == card2.value) {
    //            var pair = new Pair();
    //            pair.add(card1);
    //            pair.add(card2);
    //            pairList.add(pair);
    //            i++;
    //        }
    //    }
    //    if (!!pairList && pairList.size > 0)
    //        return pairList;
    //    return null;
    //}

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
     * 组合模型提取器
     */
    var CompositeTaker = function () {
        this.list = [];
        //提取炸弹
        this.list.push(new BombTaker());
        //提取三条
        this.list.push(new ThreeBarTaker());
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
        return model;

    }
    //***********************提取器结束********************************


    //***********************提示开始********************************

    /**
     * 对子提示提取器
     * @constructor
     */
    var PairHintTaker = function () {

    }

    PairHintTaker.prototype.take =function (model) {

    }

    /**
     * 两对提示提取器
     * @constructor
     */
    var TwoPairHintTaker = function () {

    }

    TwoPairHintTaker.prototype.take =function (model) {

    }
    /**
     * 三条提示提取器
     * @constructor
     */
    var ThreeHintTaker = function () {

    }

    ThreeHintTaker.prototype.take =function (model) {

    }
    /**
     * 顺子提示提取器
     * @constructor
     */
    var StraightHintTaker = function () {

    }

    StraightHintTaker.prototype.take =function (model) {

    }
    /**
     * 同花提示提取器
     * @constructor
     */
    var FlushHintTaker = function () {

    }

    FlushHintTaker.prototype.take =function (model) {

    }
    /**
     * 葫芦提示提取器
     * @constructor
     */
    var FullHouseHintTaker = function () {

    }

    FullHouseHintTaker.prototype.take =function (model) {

    }
    /**
     * 葫芦提示提取器
     * @constructor
     */
    var FourHintTaker = function () {

    }

    FourHintTaker.prototype.take =function (model) {

    }
    /**
     * 葫芦提示提取器
     * @constructor
     */
    var StraightFlushHintTaker = function () {

    }

    StraightFlushHintTaker.prototype.take =function (model) {

    }
    /**
     * 四条提示提取器
     * @constructor
     */
    var BombHintTaker = function () {

    }

    BombHintTaker.prototype.take =function (model) {

    }

    //***********************提示结束********************************
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
        if (this.list.length != 52)
            return false;
        return true;
    }
    Deck.prototype.initial = function() {
        for (var j = CardType.DIAMOND; j <= CardType.SPADE; j++)  {
            for (var i = CardValue[2]; i <= CardValue.A; i++) {
                var card = new Card(i, j);
                this.list.push(card);
            }
        }
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


    var poker = {
        CardType:CardType,
        CardValue:CardValue,
        Card:Card,
        EmptyCard:new Card(),
        Order:Order,
        PokerType:PokerType,
        SpecialPokerType:SpecialPokerType,
        Cards:Cards,
        SpecialCards:SpecialCards,

        Pair:Pair,
        Three:Three,
        Four:Four,
        Straight:Straight,
        Flush:Flush,
        StraightFlush:StraightFlush,

        SingleTaker:SingleTaker,
        PairTaker:PairTaker,
        ThreeTaker:ThreeTaker,
        FourTaker:FourTaker,
        StraightTaker:StraightTaker,
        FlushTaker:FlushTaker,
        StraightFlushTaker:StraightFlushTaker,

        HighEntity:HighEntity,
        PairEntity:PairEntity,
        TwoPairEntity:TwoPairEntity,
        ThreeBarEntity:ThreeBarEntity,
        StraightEntity:StraightEntity,
        FlushEntity:FlushEntity,
        FullHouseEntity:FullHouseEntity,
        StraightFlushEntity:StraightFlushEntity,
        FourEntity:FourEntity,

        Deck:Deck,


        DragonFlushEntity:DragonFlushEntity,
        DragonEntity:DragonEntity,
        TwelveKingEntity:TwelveKingEntity,
        ThreeStraightFlushEntity:ThreeStraightFlushEntity,
        ThreeBombEntity:ThreeBombEntity,
        AllBigEntity:AllBigEntity,
        AllSmallEntity:AllSmallEntity,
        OneColorEntity:OneColorEntity,
        FourThreeEntity:FourThreeEntity,
        FivePairThreeEntity:FivePairThreeEntity,
        SixPairEntity:SixPairEntity,
        ThreeFlushEntity:ThreeFlushEntity,
        ThreeStraightEntity:ThreeStraightEntity,


        NormalEntity:NormalEntity,



        FlushEntityTaker:FlushEntityTaker,
        //StraightEntityTaker:StraightEntityTaker,
        //SingleModel:SingleModel,
        //PairModel:PairModel,
        //ThreeBarModel:ThreeBarModel,
        //BombModel:BombModel,


        //PairHintTaker:PairHintTaker,
        //TwoPairHintTaker:TwoPairHintTaker,
        //ThreeHintTaker:ThreeHintTaker,
        //StraightHintTaker:StraightHintTaker,
        //FlushHintTaker:FlushHintTaker,
        //FullHouseHintTaker:FullHouseHintTaker,
        //FourHintTaker:FourHintTaker,
        //StraightFlushHintTaker:StraightFlushHintTaker,
    };
    if(typeof module !== 'undefined' && module.exports){
        module.exports = poker;
    } else if(typeof define === 'function' && define.amd){
        define([], function () {
            return poker;
        });
    } else {
        global.sssPoker = poker;
    }
}(this));