const items = require('./items');
const config = require('./config');
const rarityColours = ['#dddddd','#22ff00','#00ddff','#ffbb00']

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
	
	mod.hook('S_SYSTEM_MESSAGE',1,e=>{
		if(enabled&&e.message.startsWith('@679')){
			var msg = e.message.split('\u000b');
			var res = items.find(item => item.id == msg[4].slice(6));
			if(res){
				mod.command.message(`${msg[2]} dropped <font color="${rarityColours[res.rarity]}">${msg[6]}x ${res.name_string}</font>`)
			};
		}
	});
	
}