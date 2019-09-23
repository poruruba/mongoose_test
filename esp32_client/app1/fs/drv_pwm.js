load('api_pwm.js');
load('api_gpio.js');

let Pwm = {
	initialize: function(){
		RPC.addHandler('Pwm.set', function(args, err, parent) {
			for( let i = 0 ; i < args.list.length; i++ ){
				let val = args.list[i];
				if( val.freq === 0 ){
					GPIO.set_mode(val.pin, GPIO.MODE_INPUT);
				}else{
					PWM.set(val.pin, val.freq, val.duty);
				}
			}
			
			return { num: args.list.length };
		}, this);
	},
};
