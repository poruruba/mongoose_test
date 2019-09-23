'use strict';

var mongoose = null;
var bme280 = null;
var dht12 = null;
var mqtt_client = null;

const target_url = "http://XXX.XXX.XXX.XXX";
const forward_url = 'http://localhost:10080/mongoose';
const mqtt_url = "MQTTブローカのURL";

const PIN_BUTTON1 = 4;
const PIN_BUTTON2 = 21;
const PIN_LED = 25;
const PIN_MOTION = 16;

var vue_options = {
    el: "#top",
    data: {
        progress_title: '',

        target_url: target_url,
        forward_url: forward_url,
        mqtt_url: mqtt_url,
        connected: false,
        dht12_data: null,
        bme280_data: null,
        motion_detected: false,
        button1_detected: false,
        button2_detected: false,
    },
    computed: {
    },
    methods: {
        update_envdata: async function(){
            this.dht12_data = await dht12.readSensorData();
//            console.log(this.dht12_data);
            this.bme280_data = await bme280.readSensorData(); 
//            console.log(this.bme280_data);
        },
        mqtt_onMessagearrived: async function(message){
            var topic = message.destinationName;
            console.log(topic);
            switch(topic){
                case "/mongoose/motion": {
                    var body = JSON.parse(message.payloadString);
                    console.log(body[0]);
                    this.motion_detected = (body[0].value != 0);
                    if( this.motion_detected)
                        await mongoose.rpcCall("/GPIO.write", { pin: PIN_LED, value: 1 } );
                    break;
                }
                case "/mongoose/button": {
                    var body = JSON.parse(message.payloadString);
                    for( var i = 0 ; i < body.length ; i++ ){
                        switch(body[i].pin){
                            case PIN_BUTTON1:
                                this.button1_detected = ( body[i].value == 0 );
                                if( body[i].value == 0 )
                                    await mongoose.rpcCall("/GPIO.write", { pin: PIN_LED, value: 0 } );
                                break;
                            case PIN_BUTTON2:
                                this.button2_detected = ( body[i].value == 0 );
                                if( body[i].value == 0 )
                                    await mongoose.rpcCall("/GPIO.Toggle", { pin: PIN_LED } );
                                break;
                            default:
                                console.log("Unknown pin");
                                break;
                        }
                    }
                    break;
                }
                default:
                    console.log('Unknown topic');
                    break;
            }
        },
        mqtt_onConnectionLost: function(errorCode, errorMessage){
            console.log("MQTT.onConnectionLost", errorCode, errorMessage);
        },
        mqtt_onConnect: async function(){
            console.log("MQTT.onConnect");
            mqtt_client.subscribe("/mongoose/#");

            await mongoose.rpcCall("/Motion.setup", { pin: PIN_MOTION } );
            await mongoose.rpcCall("/Button.setup", { pin_list: [PIN_BUTTON1, PIN_BUTTON2] } );

            await mongoose.rpcCall("/GPIO.write", { pin: PIN_LED, value: 0 } );
            this.connected = true;

            await mongoose.rpcCall("/Motion.setEvent", { interval: 500 } );
            await mongoose.rpcCall("/Button.setEvent", { interval: 200 } );

/*
            var ledbar = new Grove_LED_Bar(mongoose, 21, 4, 0, 10);
            ledbar.setLevel(3);
*/
/*
            var bme680 = new Bme680(mongoose);
            await bme680.initialize();
            console.log(await bme680.getSensorData());
*/
/*
            var tsl2561 = new TSL2561_CalculateLux(mongoose);
            await tsl2561.init();
            console.log(await tsl2561.readVisibleLux());
*/            
        },
        connect_mongoose: async function(){
            mongoose = new Mongoose({ target_url: this.target_url, forward_url: this.forward_url } );
            await mongoose.rpcCall("/GPIO.write", { pin: PIN_LED, value: 1 } );

            bme280 = new BME280(mongoose);
            await bme280.initialize();
            dht12 = new DHT12(mongoose);

            this.update_envdata();

            mqtt_client = new Paho.MQTT.Client(this.mqtt_url, "browser");
            mqtt_client.onMessageArrived = this.mqtt_onMessagearrived;
            mqtt_client.onConnectionLost = this.mqtt_onConnectionLost;
            
            mqtt_client.connect({
                onSuccess: this.mqtt_onConnect
            });
        }
    },
    created: function(){
    },
    mounted: function(){
        proc_load();
    }
};
vue_add_methods(vue_options, methods_utils);
var vue = new Vue( vue_options );
