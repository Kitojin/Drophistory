const fs = require('fs');

module.exports = function drophistory(mod) {
	let config = mod.settings;

	const players = new Set();
	const itemNames = new Map();

	let currentParty = [];
	
	for (let item of config.whitelist) {
		mod.queryData('/StrSheet_Item/String@id=?', [parseInt(item)]).then(res => {
			itemNames.set(+item, res.attributes.string);
		}).catch(e => { mod.error(e) });
	}

	mod.command.add('dh', {
		$none() {
			config.enable = !config.enable;
			mod.command.message(`drophistory ${config.enable ? 'en' : 'dis'}abled`);
		},

		log(...args) {
			if (args.length == 0) {
				mod.command.message('Usage: dh log [file|chat|party|self] to toggle modes')
				return;
			} else {
				if (args.includes('file')) {
					config.logToFile = !config.logToFile;
					if (!config.logToFile) saveLog();
				}
				if (args.includes('chat')) {
					config.logToChat = !config.logToChat;
				}
				if (args.includes('party')) {
					config.partyLogging = !config.partyLogging;
					if (config.partyLogging) addPartyMembers();
				}
				if (args.includes('self')) {
					config.selfLogging = !config.selfLogging;
					if (config.selfLogging) AddToSetIfNew(mod.game.me.name);
				}
			}
			showCurrentLogState();
		},

		save() {
			saveLog()
			//Saving the log clears players that are being kept track of, so readd them here
			if (config.partyLogging) addPartyMembers();
			if (config.selfLogging) AddToSetIfNew(mod.game.me.name);
		},

		whitelist:{
			add(item){
				//strip chatlink to get item id
				item = item.replace(/^<.*#+/, '').replace(/@.+$/,'').trim();
				//Add item to whitelist and re-query DC to get localised itemname
				config.whitelist.push(parseInt(item));
				mod.queryData('/StrSheet_Item/String@id=?',[parseInt(item)]).then(res=>{
					itemNames.set(+item, res.attributes.string);
					mod.command.message(`added ${res.attributes.string}`)
				}).catch(e=>{mod.error(e)});	
				
			},
			remove(item){
				item = item.replace(/^<.*#+/, '').replace(/@.+$/,'').trim();
				config.whitelist = config.whitelist.filter(itm => itm != item);
				mod.command.message(`removed ${itemNames.get(item)}`);
				itemNames.delete(item);
			}
		},

		$default() {
			mod.command.message('Usage: dh [log|whitelist|save]')
		}
	});

	function isInSet(name) {
		for (let player of players) {
			if (player.name == name) return true;
		}
		return false;
	}

	function AddToSetIfNew(name) {
		if (!isInSet(name)) {
			let newPlayer = {
				name: name,
				droppedItems: new Map()
			}
			players.add(newPlayer);
		}
	}

	function addPartyMembers() {
		for (let player of currentParty) {
			AddToSetIfNew(player.name)
		}
	}

	function showCurrentLogState() {
		let logFrom = '';
		if (config.selfLogging && config.partyLogging) {
			logFrom = 'self and party';
		} else if (config.selfLogging) {
			logFrom = 'self';
		} else if (config.partyLogging) {
			logFrom = 'party';
		} else {
			logFrom = 'nobody'
		}

		let logTo = '';
		if (config.logToChat && config.logToFile) {
			logTo = 'in chat and file'
		} else if (config.logToChat) {
			logTo = 'in chat'
		} else if (config.logToFile) {
			logTo = 'in file'
		} else {
			logTo = 'nowhere!'
		}

		mod.command.message(`Currently logging for: ${logFrom}, log is shown ${logTo}`);
	}

	function normaliseItemToken(msg, e) {
		//Split up itemname into id and dbid (if existant) and streamline field names
		msg.tokens.ItemName = msg.tokens.ItemName.replace('@item:', '').split('?dbid:');
		if (msg.id == 'SMT_LOOTED_SPECIAL_ITEM') { msg.tokens.ItemName[1] = '' + e.uniqueId; }
		msg.tokens.UserName = ('UserName' in msg.tokens) ? msg.tokens.UserName : msg.tokens.PartyPlayerName;
	}

	async function printChatLog(msg) {
		//grab item rarity via DC query
		const rarityRes = await mod.queryData('/ItemData/Item@id=?/', [parseInt(msg.tokens.ItemName[0])]).catch(e => { mod.error(e) });
		const rarity = rarityRes.attributes.rareGrade;

		//add admount of stats to exo items and construct chat message.
		const statItem = config.exoItems.find(i => i.id == msg.tokens.ItemName[0]);
		const chatActionLinkString = `<ChatLinkAction param=\"1#####${msg.tokens.ItemName[0]}@${msg.tokens.ItemName[1]}@${msg.tokens.UserName}\">`;

		let chatMsg = [
			`${msg.tokens.UserName} picked up`,																//playername
			`<font color="${config.rarityColours[rarity]}">`, 												//font colour
			`${(msg.tokens.ItemName.length > 1 ? chatActionLinkString : '')}`, 								//if item is a gearpiece (has dbid), link it
			`&lt;${msg.tokens.ItemAmount}x `,																//amount
			`${itemNames.get(parseInt(msg.tokens.ItemName[0])) + (statItem ? statItem.statString : '')}`,	//get localised String. if it's exo gear, append amount of stats
			`&gt;${(msg.tokens.ItemName.length > 1 ? '</ChatLinkAction>' : '')}</font>`						//close link tag if item is a gearpiece
		]
		mod.command.message(chatMsg.join(''))
	}

	function updateFileLog(msg) {
		if (!isInSet(msg.tokens.UserName)) mod.error(`[DEBUG]:${msg.tokens.UserName} not in Set!`)

		for (const player of players) {
			if (player.name != msg.tokens.UserName) continue;
			//if item already in Map, add up amounts
			if (player.droppedItems.has(itemNames.get(parseInt(msg.tokens.ItemName[0])))) {
				player.droppedItems.set(
					itemNames.get(parseInt(msg.tokens.ItemName[0])), //get Itemname from ID in message...
					player.droppedItems.get(itemNames.get(parseInt(msg.tokens.ItemName[0]))) + parseInt(msg.tokens.ItemAmount) //
				);
			} else { //otherwise add new item
				player.droppedItems.set(
					itemNames.get(parseInt(msg.tokens.ItemName[0])),
					parseInt(msg.tokens.ItemAmount)
				);
			}

		}
	}

	function handleSysMsg(e) {
		if (!config.enable) return
		if (!config.logToChat && !config.logToFile) return

		var msg = mod.parseSystemMessage(e.message ? e.message : e.sysmsg);
		if (msg.id == 'SMT_PARTY_LOOT_ITEM_PARTYPLAYER' || msg.id == 'SMT_LOOTED_ITEM' || msg.id == 'SMT_LOOTED_SPECIAL_ITEM') {
			normaliseItemToken(msg, e);

			//filter by whitelist and logging mode
			if (!config.whitelist.includes(parseInt(msg.tokens.ItemName[0]))) return;
			if (!config.partyLogging && msg.tokens.UserName != mod.game.me.name) return;
			if (!config.selfLogging && msg.tokens.UserName == mod.game.me.name) return;

			if (config.logToChat) printChatLog(msg);
			if (config.logToFile) updateFileLog(msg);
		}
	}

	function saveLog() {
		if(players.size==0) return;

		let logIsEmpty = true;
		let logOutput = '';
		
		for (const player of players) {
			if (player.droppedItems.size == 0) continue;
			logIsEmpty = false;
			logOutput += '\n\t' + player.name
			for (let item of player.droppedItems) {
				logOutput += '\n\t\t> ' + item[1] + 'x ' + item[0]
			}
			logOutput += '\n'
		}

		if(!logIsEmpty){
			logOutput = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + logOutput;
		}

		players.clear();
		logIsEmpty = true;

		fs.appendFile('DropLog.txt', logOutput, (err) => {
			if (err) {
				mod.error(err);
			} else {
				mod.log('Log saved!');
			}
		});
	}

	mod.hook('S_SYSTEM_MESSAGE', 1, handleSysMsg);
	mod.hook('S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM', 1, handleSysMsg);
	mod.hook('S_SYSTEM_MESSAGE_LOOT_ITEM', 1, handleSysMsg);

	mod.hook('S_PARTY_MEMBER_LIST', 7, e => {
		if (!config.enable) return;
		currentParty = e.members;
		if (!config.partyLogging) return;
		addPartyMembers();
	});

	mod.hook('S_LOGIN', 14, e => {
		if (config.selfLogging) AddToSetIfNew(mod.game.me.name);
	})

	this.destructor = () => {
		if (config.logToFile) saveLog();
	}
}