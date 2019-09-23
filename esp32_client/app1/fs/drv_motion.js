load('api_gpio.js');
load('api_timer.js');
load('api_mqtt.js');
load('api_rpc.js');

let Motion = {
	pin: -1,
	prev_value: -1,
	topic: "/mongoose/motion",
	timer_id: -1,

	initialize: function(){
		RPC.addHandler('Motion.setup', function(args, err, parent) {
			parent.setup(args.pin);
			return {};
		}, this);
	},
	
	setup: function(input){
		this.pin = input;
		this.prev_value = -1;
		GPIO.set_mode(input, GPIO.MODE_INPUT);
		
		RPC.addHandler('Motion.setEvent', function(args, err, parent) {
			if( args.topic )
				parent.topic = args.topic;
			if( args.interval <= 0 ){
				parent.stop_event();
				return { event: false };
			}else{
				parent.set_event(args.interval);
				return { event: true, pin: parent.pin };
			}
		}, this);
	},
	
	read: function(){
		return GPIO.read(this.pin);
	},
	
	set_event: function(interval){
		this.stop_event();
		
		this.timer_id = Timer.set(interval, Timer.REPEAT, function(parent) {
			let event_list = [];
			let val = parent.read();
			if( val !== parent.prev_value ){
				event_list.push({ pin: parent.pin, value: val} );
				parent.prev_value = val;
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
