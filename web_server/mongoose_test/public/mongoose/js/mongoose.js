'use strict';

class Mongoose{
	constructor(params){
    this.params = params;

    this.i2c0 = new I2C(this);
    this.io0 = new GPIO(this);
    this.i2c = new I2C_Bus(this.i2c0);
    this.Wire = new Arduino_Wire(this.i2c0);
    this.GPIO = new Arduino_GPIO(this.io0);
  }
  
  async rpcCall(url, body){
    const headers = new Headers( { "Content-Type" : "application/json" } );
  
    body.target_url = this.params.target_url + "/rpc" + url;
  
    return fetch(this.params.forward_url, {
        method : 'POST',
        body : JSON.stringify(body),
        headers: headers
    })
    .then((response) => {
        if( !response.ok )
            throw 'response is not ok.';
        return response.json();
    });
  }
}

class Arduino_GPIO{
  /* for arduino I/F */

  constructor(gpio){
    this.gpio = gpio;

    this.INPUT = 0;
    this.OUTPUT = 1;

    this.LOW = 0;
    this.HIGH = 1;

    this.DEFAULT = 0;
  }

  pinMode(pin, mode){
    // do nothing
  }

  digitalWrite(pin, value){
    return this.gpio.output(pin, value != this.LOW);
  }

  async digitalRead(pin){
    return this.gpio.inputWait(pin)
    .then(value =>{
      return (value == 0) ? this.LOW : this.HIGH;
    });
  }
}

class Arduino_Wire{
  /* for arduino I/F */

  constructor(i2c){
    this.i2c = i2c;
  }

  beginTransmission(deviceAddress){
    this.write_address = deviceAddress;
    this.write_buffer = [];
  }

  write(value){
    this.write_buffer.push(value);
  }

  endTransmission(){
    return this.i2c.write(this.write_address, this.write_buffer);
  }

  requestFrom(deviceAddress, len){
    this.read_running = true;
    return this.i2c.readWait(deviceAddress, len)
    .then(buf =>{
      this.read_buffer = buf;
      this.read_running = false;
    });
  }

  available(){
    if( !this.read_running )
      return this.read_buffer.length;
    else
      return 0;
  }

  read(){
    return this.read_buffer.shift();    
  }
}

class I2C_Bus{
  /* for npm i2c-bus I/F */

  constructor(i2c){
    this.i2c = i2c;
  }

  openSync(params){
  	return this;
  }
  
  closeSync(){
    // do nothing
  }

  writeByte(addr, cmd, byte, cb){
    this.i2c.write(addr, [cmd, byte])
    .then(() =>{
    	cb(null);
    });
  }

  readByte(addr, cmd, cb){
    this.i2c.write(addr, [cmd])
    .then(() =>{
      return this.i2c.readWait(addr, 1);
    })
    .then(buf =>{
      cb(null, buf[0]);
    });
  }

  async readByteSync(addr, cmd){
    return new Promise((resolve, reject) =>{
      this.i2c.write(addr, [cmd])
      .then(() =>{
        return this.i2c.readWait(addr, 1);
      })
      .then(buf =>{
        resolve(buf[0]);
      })
      .catch(error =>{
        reject();
      });
    });
  }    

  async readWordSync(addr, cmd){
    return new Promise((resolve, reject) =>{
      this.i2c.write(addr, [cmd])
      .then(() =>{
        return this.i2c.readWait(addr, 2);
      })
      .then(buf =>{
        resolve(buf[0] << 8 | buf[1]);
      })
      .catch(error =>{
        reject();
      });
    });
  }  

  readI2cBlock(addr, cmd, len, buffer, cb){
  	return this.i2c.write(addr, [cmd])
  	.then(() =>{
	  	return this.i2c.readWait(addr, len);
    })
    .then(buf =>{
      for( var i = 0 ; i < buf.length ; i++ )
        buffer[i] = buf[i];
      cb(null, len, buffer);
    });
  }

  readI2cBlockSync(addr, cmd, len, buffer){
  	return this.i2c.write(addr, [cmd])
  	.then(() =>{
	  	return this.i2c.readWait(addr, len);
    })
    .then(buf =>{
      for( var i = 0 ; i < buf.length ; i++ )
        buffer[i] = buf[i];
      return buf.length;
    });
  }  
}

class GPIO{
  /* for obniz gpio I/F */

	constructor(parenet){
    this.parenet = parenet;
  }

  async output(pin, value){
    var params = {
      pin: pin,
      value: value ? 1 : 0
    };
    return this.parenet.rpcCall('/GPIO.Write', params );
  }

  async inputWait(pin){
    var params = {
      pin: pin
    };
    return this.parenet.rpcCall('/GPIO.Read', params )
    .then( json =>{
      return json.value;
    })
  }
}

class I2C{
  /* for obniz i2c I/F */

  constructor(parent){
    this.parent = parent;
  }

  async start(params){
    // do nothing
  }
  
  async end(){
    // do nothing
  }

  async write(addr, data){
    var params = {
      addr: addr,
      data_hex: byteAry2hexStr(data)
    };
    return this.parent.rpcCall('/I2C.Write', params );
  }

  async readWait(addr, len){
    var params = {
      addr: addr,
      len: len
    };
    return this.parent.rpcCall('/I2C.Read', params )
    .then(json =>{
      return hexStr2byteAry(json.data_hex);
    });
  }
}

function do_post_forward(forward_url, url, body){
  const headers = new Headers( { "Content-Type" : "application/json" } );
  
  body.target_url = url;

  return fetch(forward_url, {
      method : 'POST',
      body : JSON.stringify(body),
      headers: headers
  })
  .then((response) => {
      if( !response.ok )
          throw 'response is not ok.';
      return response.json();
  });
}

function byteAry2hexStr(bytes, sep = '', pref = '') {
  if( bytes instanceof ArrayBuffer )
      bytes = new Uint8Array(bytes);
  if( bytes instanceof Uint8Array )
      bytes = Array.from(bytes);

  return bytes.map((b) => {
      var s = b.toString(16);
      return pref + (b < 0x10 ? '0'+s : s);
  })
  .join(sep);
}

function hexStr2byteAry(hexs, sep = '') {
  hexs = hexs.trim(hexs);
  if( sep == '' ){
      var array = [];
      for( var i = 0 ; i < hexs.length / 2 ; i++)
          array[i] = parseInt(hexs.substr(i * 2, 2), 16);
      return array;
  }else{
      return hexs.split(sep).map((h) => {
          return parseInt(h, 16);
      });
  }
}