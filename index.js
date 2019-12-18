const items = require('./items');
const config = require('./config');
const rarityColours = ['#ffffff','#22ff00','#00ddff','#ffcc00']

module.exports = function drophistory(mod){
	let enabled = config.toggle;
	
	mod.command.add('drophistory', args=>{
		enabled =! enabled;
		mod.command.message(`drophistory ${enabled ? 'en' : 'dis'}abled`);
	});
	
	mod.hook('S_SPAWN_DROPITEM', 8, e=>{
		if (!enabled) return;
		var res = items.find(item => item.id == e.item);
		//TODO: Query datacenter to get localised strings?
		if(res){mod.command.message(`Dropped <font color="${rarityColours[res.rarity]}">${res.name_string}</font>`);}
	});
	/*
	mod.hook('S_SYSTEM_MESSAGE',1,e=>{
		if(enabled&&e.message.startsWith('@679')){
			var msg = e.message.split('\u000b');
			var res = items.find(item => item.id == msg[4].slice(6));
			if(res){
				mod.command.message(`${msg[2]} dropped <font color="${rarityColours[res.rarity]}">${msg[6]}x ${res.name_string}</font>`)
			};
		}
	});*/
	
	mod.hook('S_SYSTEM_MESSAGE', 1,e=>{
		if (!enabled) return;
		const msg = mod.parseSystemMessage(e.message);
		if(msg.id=='SMT_PARTY_LOOT_ITEM_PARTYPLAYER'){
			//split up item token
			msg.tokens.ItemName = msg.tokens.ItemName.replace('@item:','').split('?dbid');
			if (!items.contains(msg.tokens.ItemName[0])) return;
			var rarity;
			mod.queryData('/ItemData/Item@id=?/',[parseInt(msg.tokens.ItemName[0])]).then(res =>{
				rarity = res.attributes.rareGrade;
			}).catch(e=>{console.log(e);});
			mod.queryData('/StrSheet_Item/String@id=?',[parseInt(msg.tokens.ItemName[0])]).then(res=>{
				mod.command.message(`${msg.tokens.PartyPlayerName} picked up <font color="${rarityColours[rarity]}">${msg.tokens.ItemAmount}x ${res.attributes.string}</font>`)
			}).catch(e=>{console.log(e);});
		}
	});
	//mod.hook('C_LOGIN_ARBITER',2,e=>{console.log(e);});
	
}