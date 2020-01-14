const whitelist = require('./whitelist');
const exoItems = require('./exoItems');
const config = require('./config');
const rarityColours = ['#ffffff','#22ff00','#00ccff','#ffcc00']
const fs = require('fs');

module.exports = function drophistory(mod){
	let enabled = config.toggle;
	let partyLogging = config.partyLogging;
	let selfLogging = config.selfLoggingg;
	let logToFile = config.logToFile;
	let logToChat = config.logToChat;

	let currentParty = [];

	const players = new Set();
	const itemNames = new Map();
	for(let item of whitelist){
		res = mod.queryData('/StrSheet_Item/String@id=?',[parseInt(item)]).then(res=>{
			itemNames.set(item, res.attributes.string);
		})
		.catch(e=>{mod.error(e)});
	}
	
	mod.command.add('dh',{
		$none(){
			enabled =! enabled;
			mod.command.message(`drophistory ${enabled ? 'en' : 'dis'}abled`);
		},

		log(...args){
			if(args.length==0){
				mod.command.message('Usage: dh log [file|chat|party|self] to toggle modes')
			} else {
				if(args.includes('file')){	
					logToFile = !logToFile;
					if(!logToFile)saveLog();
				}
				if(args.includes('chat')) 	logToChat = !logToChat;
				if(args.includes('party')){ 	
					partyLogging = !partyLogging;
					if(partyLogging) addPartyMembers();
				}
				if(args.includes('self')){	
					selfLogging = !selfLogging;
					if(selfLogging) AddToSetIfNew(mod.game.me.name);
				}
			}
			showCurrentLogState();
		},

		save(){
			saveLog()
		},

		whitelist(item){
			//TODO: strip chatlink to get item id
			console.log(item);
			//TODO: Add item to whitelist and re-query DC to get localised itemname
			/*whitelist.push(Number(item))
			mod.queryData('/StrSheet_Item/String@id=?',[parseInt(item)]).then(res=>{
				itemNames.set(item, res.attributes.string);
			}).catch(e=>{mod.error(e)});*/
		},

		$default(){
			mod.command.message('Usage: dh [log|whitelist|save]')
		}
	});

	function isInSet(name){
		for(let player of players){
			if(player.name == name) return true;
		}
		return false;
	}

	function AddToSetIfNew(name){
		if(!isInSet(name)){
			let newPlayer = {
				name: name,
				droppedItems: new Map()
			}
			players.add(newPlayer);
		}
	}

	function addPartyMembers(){
		for(let player of currentParty){
			AddToSetIfNew(player.name)
		}
	}

	function showCurrentLogState(){
		let logFrom = `${selfLogging && partyLogging ? 'self and party' : selfLogging ? 'self' : partyLogging ? 'party' : 'nobody'}`
		let logTo = `${logToChat&&logToFile ? 'in chat and file.' : logToChat ? 'in chat.' : logToFile ? 'in file.' : 'nowhere!'}`
		mod.command.message(`Currently logging for: ${logFrom}, log is shown ${logTo}`);
	}

	function normaliseItemToken(msg, e){
		//Split up itemname into id and dbid (if existant) and streamline field names
		msg.tokens.ItemName = msg.tokens.ItemName.replace('@item:','').split('?dbid:');
		if(msg.id=='SMT_LOOTED_SPECIAL_ITEM'){msg.tokens.ItemName[1]=''+e.uniqueId;}
		msg.tokens.UserName = ('UserName' in msg.tokens) ? msg.tokens.UserName : msg.tokens.PartyPlayerName;
	}
	
	async function printChatLog(msg){
		//grab item rarity via DC query
		const rarityRes = await mod.queryData('/ItemData/Item@id=?/',[parseInt(msg.tokens.ItemName[0])]).catch(e=>{mod.error(e)});
		const rarity = rarityRes.attributes.rareGrade;
		
		//add admount of stats to exo items and construct chat message.
		const statItem = exoItems.find(i=>i.id==msg.tokens.ItemName[0]);
		const chatActionLinkString = `<ChatLinkAction param=\"1#####${msg.tokens.ItemName[0]}@${msg.tokens.ItemName[1]}@${msg.tokens.UserName}\">`;
		//This is an abomination, don't look at it. Seriously. DO NOT TOUCH!
		mod.command.message(`${msg.tokens.UserName} picked up <font color="${rarityColours[rarity]}">${(msg.tokens.ItemName.length > 1 ? chatActionLinkString : '')}&lt;${msg.tokens.ItemAmount}x ${itemNames.get(parseInt(msg.tokens.ItemName[0])) + (statItem ? statItem.statString : '')}&gt;${(msg.tokens.ItemName.length > 1 ? '</ChatLinkAction>' : '')}</font>`);
	}

	function updateFileLog(msg){
		if(!isInSet(msg.tokens.UserName)) mod.error(`[DEBUG]:${msg.tokens.UserName} not in Set!`)
		for (const player of players){
			if(player.name == msg.tokens.UserName){
				//if item already in Map, add up amounts
				if(player.droppedItems.has(itemNames.get(parseInt(msg.tokens.ItemName[0])))){
					player.droppedItems.set(
						itemNames.get(parseInt(msg.tokens.ItemName[0])), //get Itemname from ID in message...
						player.droppedItems.get(itemNames.get(parseInt(msg.tokens.ItemName[0])))+parseInt(msg.tokens.ItemAmount) //
					);
				} else { //otherwise add new item
					player.droppedItems.set(
						itemNames.get(parseInt(msg.tokens.ItemName[0])), 
						parseInt(msg.tokens.ItemAmount)
					);
				}
			}
		}
	}

	function handleSysMsg(e){
		if(!enabled) return
		if(!logToChat&&!logToFile) return

		var msg = mod.parseSystemMessage(e.message ? e.message : e.sysmsg);
		if(msg.id=='SMT_PARTY_LOOT_ITEM_PARTYPLAYER'||msg.id=='SMT_LOOTED_ITEM'||msg.id=='SMT_LOOTED_SPECIAL_ITEM'){
			normaliseItemToken(msg, e);
			
			//filter by whitelist and logging mode
			if (!whitelist.includes(parseInt(msg.tokens.ItemName[0])))return;
			if (!partyLogging 	&& msg.tokens.UserName != mod.game.me.name) return;
			if (!selfLogging 	&& msg.tokens.UserName == mod.game.me.name) return;

			if(logToChat) printChatLog(msg);
			if(logToFile) updateFileLog(msg);
		}	
	}

	function saveLog(){
		let logOutput = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
		for(const player of players){
			if(player.droppedItems.size>0){
				logOutput+='\t'+player.name
				for(let item of player.droppedItems){
					logOutput+='\t\t> '+item[1]+'x '+item[0]+'\r\n'
				}
			}
			logOutput+='\n\r'
		}
		players.clear();
		fs.appendFile('DropLog.txt',logOutput,(err)=>{
			if(err){ throw (err);} else mod.log('Log saved!');
		});
	}

	mod.hook('S_SYSTEM_MESSAGE', 1, handleSysMsg);
	mod.hook('S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM', 1, handleSysMsg);
	mod.hook('S_SYSTEM_MESSAGE_LOOT_ITEM',1, handleSysMsg);

	mod.hook('S_PARTY_MEMBER_LIST',7,e=>{
		if (!enabled) return;
		currentParty = e.members;
		if(!partyLogging) return;
		addPartyMembers();
	});

	mod.hook('S_LOGIN',14,e=>{
		if(selfLogging) AddToSetIfNew(mod.game.me.name);
	})

	this.destructor = ()=>{
		if(logToFile) saveLog();
		mod.log('Destructor got called!')
	}
}