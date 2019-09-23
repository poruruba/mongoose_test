'use strict';

var obniz = null;
var wemos = null;

var vue_options = {
    el: "#top",
    data: {
        progress_title: '',

        connected: false,
        firmware_ver: '',
        string: '',
        obniz_id: "ObnizのdeviceID"
    },
    computed: {
    },
    methods: {
        connect_obniz: function(){
            obniz = new Obniz(this.obniz_id);
            obniz.onconnect = async () => {
                console.log('obniz.onconnect');

            this.connected = true;
            this.firmware_ver = obniz.firmware_ver;

            wemos = new WeMos(obniz);
            wemos.display.clear();
            };
            obniz.onclose = () =>{
                console.log('obniz.onclose');
                wemos = null;
                this.connected = false;
                this.firmware_ver = '';
            };
        },
        print_string: function(){
            if( obniz == null || wemos == null ){
                alert('obnizまたはwemosと接続していません。');
                return;
            }

            try{
                const ctx = obniz.util.createCanvasContext(wemos.display.width, wemos.display.height);
                
                ctx.fillStyle = "white";
                ctx.font = "20px Avenir";
                ctx.fillText(this.string, 0, 40);

                wemos.display.draw(ctx);
            }catch( error ){
                alert(error);
            }
        },
        clear_screen: function(){
            if( obniz == null || wemos == null ){
                alert('obnizまたはwemosと接続していません。');
                return;
            }

            try{
                wemos.display.clear();
            }catch( error ){
                alert(error);
            }
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
