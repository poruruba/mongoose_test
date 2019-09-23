'use strict';

class DHT12 {
  constructor(device, i2cAddress) {
    this.i2cBus = device.i2c.openSync();
    this.i2cAddress = i2cAddress ? i2cAddress : DHT12.DEFAULT_I2C_ADDRESS();
  }

  async readSensorData(){
    var buffer = new Array(5);
    await this.i2cBus.readI2cBlockSync(this.i2cAddress, 0, 5, buffer);

    var chksum = buffer[0] + buffer[1] + buffer[2] + buffer[3];
    if( buffer[4] != chksum )
      throw 'dht12 checksum error'; 

    var humidity = buffer[0] + (buffer[1] & 0x0f) * 0.1;

    var temperature = buffer[2] + (buffer[3] & 0x0f) * 0.1;
    if( (buffer[3] & 0x80) != 0x00 )
      temperature *= -1.0;

    return {
      humidity: humidity,
      temperature: temperature
    };
  }

  static DEFAULT_I2C_ADDRESS() {
    return 0x5C;
  }
}