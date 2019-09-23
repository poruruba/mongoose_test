load('api_gpio.js');
load('api_timer.js');
load('api_mqtt.js');
load('api_rpc.js');

let Button = {
	pin_list: [],
	prev_value: [],
	topic: "/mongoose/button",
	timer_id: -1,
	
	initialize: function(){
		RPC.addHandler('Button.setup', function(args, err, parent) {
			parent.setup(args.pin_list);
			return {};
		}, this);
	},
	
	setup: function(input_list){
		for( let i = 0 ; i < input_list.length ; i++ ){
			this.pin_list[i] = input_list[i];
			this.prev_value[i] = -1;
			GPIO.set_mode(input_list[i], GPIO.MODE_INPUT);
		}
		
		RPC.addHandler('Button.setEvent', function(args, err, parent) {
			if( args.topic )
				parent.topic = args.topic;
			if( args.interval <= 0 ){
				parent.stop_event();
				return { event: false };
			}else{
				parent.set_event(args.interval);
				return { event: true, pin_list: parent.pin_list };
			}
		}, this);
	},
	
	read: function(no){
		return GPIO.read(this.pin_list[no]);
	},
	
	set_event: function(interval){
		this.stop_event();
		
		this.timer_id = Timer.set(interval, Timer.REPEAT, function(parent) {
			let event_list = [];
			for( let i = 0 ; i < parent.pin_list.length ; i++ ){
				let val = parent.read(i);
				if( val !== parent.prev_value[i] ){
					event_list.push({ pin: parent.pin_list[i], value: val} );
					parent.prev_value[i] = val;
				}
			}
			if( event_list.length > 0 ){
				let res = MQTT.pub(parent.topic, JSON.stringify(event_list));
				if( res <= 0 )
					print("MQTT.pub error");
			}
		}, this);
	},
	
	stop_event: function(){
		if( this.timer_id !== -1 ){
			Timer.del(this.timer_id);
			this.timer_id = -1;
		}
	},
};
