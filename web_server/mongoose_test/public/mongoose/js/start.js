'use strict';

var mongoose = null;
var wemos = null;

const target_url = "http://XXX.XXX.XXX.XXX";
const forward_url = 'http://localhost:10080/mongoose';

var vue_options = {
    el: "#top",
    data: {
        progress_title: '',

        target_url: target_url,
        forward_url: forward_url,
        string: '',
    },
    computed: {
    },
    methods: {
        connect_mongoose: async function(){
            mongoose = new Mongoose({ target_url: this.target_url, forward_url: this.forward_url } );
            wemos = new WeMos(mongoose);
            await wemos.display.clear();
        },
        print_string: function(){
            if( wemos == null ){
                alert('wemosと接続していません。');
                return;
            }

            try{
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, wemos.display.width, wemos.display.height);

                ctx.fillStyle = "white";
                ctx.font = "20px Avenir";
                ctx.fillText(this.string, 0, 40);

                wemos.display.draw(ctx);
            }catch( error ){
                alert(error);
            }
        },
        clear_screen: function(){
            if( wemos == null ){
                alert('wemosと接続していません。');
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

        this.connect_mongoose();
    }
};
vue_add_methods(vue_options, methods_utils);
var vue = new Vue( vue_options );

