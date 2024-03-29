'use strict';

class WeMos{
	constructor(obniz){
		this.display = new WeMos_display(obniz);
	}
}

class WeMos_display{
	constructor(obniz, addr, sda, scl){
		this.obniz = obniz;

		this.ADDRESS = addr || 0x3C;
		this.SDA = sda || 5;
		this.SCL = scl || 4;

		this.obniz.i2c0.start({mode: "master", sda: this.SDA, scl: this.SCL, clock: 400000}); 

		this.WIDTH = 128;
		this.HEIGHT = 64;

		this.width = this.WIDTH;
		this.height = this.HEIGHT;
		
		this.mode = false;
		this.buffer = [];
		this.clear();
		
		this.TRANSFER_SIZE = 64;

		this.DISPLAY_OFF = 0xAE;
		this.DISPLAY_ON = 0xAF;
		this.SET_DISPLAY_CLOCK_DIV = 0xD5;
		this.SET_MULTIPLEX = 0xA8;
		this.SET_DISPLAY_OFFSET = 0xD3;
		this.SET_START_LINE = 0x00;
		this.CHARGE_PUMP = 0x8D;
		this.EXTERNAL_VCC = false;
		this.MEMORY_MODE = 0x20;
		this.SEG_REMAP = 0xA1; // using 0xA0 will flip screen
		this.COM_SCAN_DEC = 0xC8;
		this.COM_SCAN_INC = 0xC0;
		this.SET_COM_PINS = 0xDA;
		this.SET_CONTRAST = 0x81;
		this.SET_PRECHARGE = 0xd9;
		this.SET_VCOM_DETECT = 0xDB;
		this.DISPLAY_ALL_ON_RESUME = 0xA4;
		this.NORMAL_DISPLAY = 0xA6;
		this.COLUMN_ADDR = 0x21;
		this.PAGE_ADDR = 0x22;
		this.INVERT_DISPLAY = 0xA7;
		this.ACTIVATE_SCROLL = 0x2F;
		this.DEACTIVATE_SCROLL = 0x2E;
		this.SET_VERTICAL_SCROLL_AREA = 0xA3;
		this.RIGHT_HORIZONTAL_SCROLL = 0x26;
		this.LEFT_HORIZONTAL_SCROLL = 0x27;
		this.VERTICAL_AND_RIGHT_HORIZONTAL_SCROLL = 0x29;
		this.VERTICAL_AND_LEFT_HORIZONTAL_SCROLL = 0x2A;

    new Promise(async (resolve, reject) =>{
      /* initialze */
      try{
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.DISPLAY_OFF]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SET_DISPLAY_CLOCK_DIV, 0x80]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SET_MULTIPLEX, 0x3F]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SET_DISPLAY_OFFSET, 0x00]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SET_START_LINE]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.CHARGE_PUMP, 0x14]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.MEMORY_MODE, 0x00]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SEG_REMAP]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.COM_SCAN_DEC]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SET_COM_PINS, 0x12]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SET_CONTRAST, 0x8F]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SET_PRECHARGE, 0xF1]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.SET_VCOM_DETECT, 0x40]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.DISPLAY_ALL_ON_RESUME]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.NORMAL_DISPLAY]);
        await this.obniz.i2c0.write(this.ADDRESS, [0x00, this.DISPLAY_ON]);

        this.mode = true;

        resolve();
      }catch(error){
        reject(error);
      }
    });
  }
  
  async clear(){
    for( var y = 0 ; y < this.fl(this.HEIGHT / 8) ; y++ ){
      for( var x = 0 ; x < this.WIDTH ; x++ ){
        this.buffer[ y * this.WIDTH + x ] = 0x00;
      }
    }
  
    if( this.mode ){
      return this.update();
    }else{
      return Promise.resolve();
    }
  }
  
  async drawing(mode){
    this.mode = mode;
    if( this.mode ){
      return this.update();
    }else{
      return Promise.resolve();
    }
  }
  
  async raw(ary){
    for( var y = 0 ; y < this.HEIGHT ; y++ ){
      for( var x = 0 ; x < this.WIDTH ; x += 8 ){
        var val = ary[y * this.fl(this.WIDTH / 8) + this.fl(x / 8)];
        for( var i = 0 ; i < 8 ; i++ )
          this.put_pixel(x + i, y, (val & (0x01 << i)) != 0x00);
      }
    }

    if( this.mode ){
      return this.update();
    }else{
      return Promise.resolve();
    }
  }
  
  async draw(ctx){
      var img = ctx.getImageData(0, 0, this.WIDTH, this.HEIGHT);

    for (var y = 0; y < this.HEIGHT; y++ ) {
      for (var x = 0; x < this.WIDTH; x++) {
        var val = this.to_mono(img.data[(x + y * this.WIDTH) * 4], img.data[(x + y * this.WIDTH) * 4 + 1], img.data[(x + y * this.WIDTH) * 4 + 2], img.data[(x + y * this.WIDTH) * 4 + 3]);
        this.put_pixel(x, y, val);
      }
    }

    if( this.mode ){
      return this.update();
    }else{
      return Promise.resolve();
    }
  }
  
  put_pixel(x, y, val){
    var temp = this.buffer[this.fl(y / 8) * this.WIDTH + x];
    var index = y % 8;
    if(val)
      temp |= 0x01 << index;
    else
      temp &= (~(0x01 << index)) & 0xff;
    this.buffer[this.fl(y / 8) * this.WIDTH + x] = temp;
  }
  
  async update(){
    var ret = await this.obniz.i2c0.readWait(this.ADDRESS, 1);
    if( (ret[0] >> 7) & 0x01 != 0x00 ){
      console.log('busy');
      return;
    }
    
    this.obniz.i2c0.write(this.ADDRESS, [0x00, this.COLUMN_ADDR, 0, this.WIDTH - 1]);
    this.obniz.i2c0.write(this.ADDRESS, [0x00, this.PAGE_ADDR, 0, this.fl(this.HEIGHT / 8) - 1]);
    for( var y = 0 ; y < this.fl(this.HEIGHT / 8) ; y++ ){
      for( var x = 0 ; x < this.WIDTH ; x += this.TRANSFER_SIZE ){
        var data = this.buffer.slice( y * this.WIDTH + x, y * this.WIDTH + x + this.TRANSFER_SIZE);
        data.unshift(0x40);
        await this.obniz.i2c0.write(this.ADDRESS, data);
      }
    }
  }

  fl(f){
    return Math.floor(f);
  }
  
  to_mono(r, g, b, a){
    var grey = r * 0.299 + g * 0.587 + b * 0.114;
    if( a > 128 || grey > 128.5)
      return 1;
    else
      return 0;
	}
}
