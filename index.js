const items = require('./items');
const config = require('./config');
const rarityColours = ['#ffffff','#22ff00','#00ccff','#ffcc00']

module.exports = function drophistory(mod){
	let enabled = config.toggle;
	
	mod.command.add('drophistory', args=>{
		enabled =! enabled;
		mod.command.message(`drophistory ${enabled ? 'en' : 'dis'}abled`);
	});
	
	function handleSysMsg(e){
		if(!enabled) return
		const msg = mod.parseSystemMessage(e.message ? e.message : e.sysmsg);
		if(msg.id=='SMT_PARTY_LOOT_ITEM_PARTYPLAYER'||msg.id=='SMT_LOOTED_ITEM'||msg.id=='SMT_LOOTED_SPECIAL_ITEM'){
			//split up item token
			msg.tokens.ItemName = msg.tokens.ItemName.replace('@item:','').split('?dbid:');
			if(msg.id=='SMT_LOOTED_SPECIAL_ITEM'){msg.tokens.ItemName[1]=''+e.uniqueId;}
			
			//filter by whitelist
			if (!items.whitelist.includes(parseInt(msg.tokens.ItemName[0])))return;
			var rarity;
			mod.queryData('/ItemData/Item@id=?/',[parseInt(msg.tokens.ItemName[0])]).then(res =>{
				rarity = res.attributes.rareGrade;
			}).catch(e=>{mod.error(e);});
			
			//add admount of stats to exo items.
			mod.queryData('/StrSheet_Item/String@id=?',[parseInt(msg.tokens.ItemName[0])]).then(res=>{
				statItem = items.statItems.find(i=>i.id==msg.tokens.ItemName[0]);
				msg.tokens.UserName = ('UserName' in msg.tokens) ? msg.tokens.UserName : msg.tokens.PartyPlayerName;
				let chatActionLinkString = `<ChatLinkAction param=\"1#####${msg.tokens.ItemName[0]}@${msg.tokens.ItemName[1]}@${msg.tokens.UserName}\">`;
				//This is an abomination, don't look at it. Seriously.
				mod.command.message(`${msg.tokens.UserName} picked up <font color="${rarityColours[rarity]}">${(msg.tokens.ItemName.length > 1 ? chatActionLinkString : '')}&lt;${msg.tokens.ItemAmount}x ${res.attributes.string + (statItem ? statItem.statString : '')}&gt;${(msg.tokens.ItemName.length > 1 ? '</ChatLinkAction>' : '')}</font>`);
			}).catch(e=>{mod.error(e);});
		}	
	}
	

	mod.hook('S_SYSTEM_MESSAGE', 1, handleSysMsg);
	mod.hook('S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM', 1, handleSysMsg);
	mod.hook('S_SYSTEM_MESSAGE_LOOT_ITEM',1, handleSysMsg);
}