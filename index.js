const items = require('./items');
const config = require('./config');
const rarityColours = ['#ffffff','#22ff00','#00ddff','#ffcc00']

module.exports = function drophistory(mod){
	let enabled = config.toggle;
	
	mod.command.add('drophistory', args=>{
		console.log(items.whitelist);
		enabled =! enabled;
		mod.command.message(`drophistory ${enabled ? 'en' : 'dis'}abled`);
	});
	/*
	mod.hook('S_SPAWN_DROPITEM', 8, e=>{
		if (!enabled) return;
		var res = items.find(item => item.id == e.item);
		//TODO: Query datacenter to get localised strings?
		if(res){mod.command.message(`Dropped <font color="${rarityColours[res.rarity]}">${res.name_string}</font>`);}
	});*/
	
	mod.hook('S_SYSTEM_MESSAGE', 1,e=>{
		if (!enabled) return;
		const msg = mod.parseSystemMessage(e.message);
		if(msg.id=='SMT_PARTY_LOOT_ITEM_PARTYPLAYER'){
			//split up item token
			msg.tokens.ItemName = msg.tokens.ItemName.replace('@item:','').split('?dbid');
			
			//filter by whitelist
			if (!items.whitelist.contains(msg.tokens.ItemName[0])) return;
			var rarity;
			mod.queryData('/ItemData/Item@id=?/',[parseInt(msg.tokens.ItemName[0])]).then(res =>{
				rarity = res.attributes.rareGrade;
			}).catch(e=>{console.log(e);});
			
			//add admount of stats to exo items.
			mod.queryData('/StrSheet_Item/String@id=?',[parseInt(msg.tokens.ItemName[0])]).then(res=>{
				statItem = items.statItems.find(i=>i.id==msg.tokens.ItemName[0]);
				mod.command.message(`${msg.tokens.PartyPlayerName} picked up <font color="${rarityColours[rarity]}">${msg.tokens.ItemAmount}x ${res.attributes.string + statItem ? statItem.statString : ''}</font>`)
			}).catch(e=>{console.log(e);});
		}
	});
}