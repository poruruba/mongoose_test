load('api_config.js');
load('api_dash.js');
load('api_events.js');
load('api_timer.js');
load('api_sys.js');

load('drv_button.js');
load('drv_motion.js');
//load('drv_pwm.js');
//load('drv_angle.js');

let state = {};  // Device state
let online = false;                               // Connected to the cloud?

Button.initialize();
Motion.initialize();
//Pwm.initialize();
//Angle.initialize();

// Update state every second, and report to cloud if online
Timer.set(10000, Timer.REPEAT, function() {
  state.uptime = Sys.uptime();
  state.ram_free = Sys.free_ram();
  print('online:', online, JSON.stringify(state));
}, null);

Event.on(Event.CLOUD_CONNECTED, function() {
  online = true;
}, null);

Event.on(Event.CLOUD_DISCONNECTED, function() {
  online = false;
}, null);
