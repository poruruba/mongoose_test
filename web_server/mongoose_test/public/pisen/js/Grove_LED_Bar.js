/*
  LED bar library V2.0
  Copyright (c) 2010 Seeed Technology Inc.

  Original Author: LG

  Modify: Loovee, 2014-2-26
  User can choose which Io to be used.

  The MIT License (MIT)

  Copyright (c) 2013 Seeed Technology Inc.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

//const { GPIO, pinMode, digitalWrite } = require('./mcp2221lib');

const GLB_CMDMODE = 0x00;  // Work on 8-bit mode
const GLB_ON = 0xff;  // 8-bit 1 data
const GLB_OFF = 0x00;  // 8-bit 0 data

const DEFAULT_LED_NUM = 10;

class Grove_LED_Bar{
  constructor(device, pinClock, pinData, greenToRed, led_num){
    this.__pinClock = pinClock;
    this.__pinData = pinData;
    this.__greenToRed = greenToRed;  // ascending or decending
    this.__led_num = led_num ? led_num : DEFAULT_LED_NUM;

    this.__state = [];
    for (var i = 0; i < this.__led_num; i++)
      this.__state[i] = 0x00;  // persist state so individual leds can be toggled
  
    this.gpio = device.GPIO;

    this.gpio.pinMode(this.__pinClock, GPIO.OUTPUT);
    this.gpio.pinMode(this.__pinData, GPIO.OUTPUT);
  }

  // Send the latch command
  async latchData()
  {
    await this.gpio.digitalWrite(this.__pinData, GPIO.LOW);
    await this.wait_async(10);

    for (var i = 0; i < 4; i++)
    {
      await this.gpio.digitalWrite(this.__pinData, GPIO.HIGH);
      await this.gpio.digitalWrite(this.__pinData, GPIO.LOW);
    }
  }


  // Send 16 bits of data
  async sendData(data)
  {
    var state = 0;
    for (var i = 0; i < 16; i++)
    {
      var state1 = (data & 0x8000) ? GPIO.HIGH : GPIO.LOW;
      await this.gpio.digitalWrite(this.__pinData, state1);

      //state = digitalRead(__pinClock) ? LOW : HIGH;
      state = 1 - state;
      await this.gpio.digitalWrite(this.__pinClock, state);

      data <<= 1;
    }
  }


  // Change the orientation
  // Green to red, or red to green
  async setGreenToRed(greenToRed)
  {
    this.__greenToRed = greenToRed;

    await this.setData(this.__state);
  }

  max(a, b){
    return ((a >= b) ? a : b);
  }

  min(a, b){
    return ((a <= b) ? a : b);
  }

  // Set level (0-__led_num)
  // Level 0 means all leds off
  // Level __led_num means all leds on
  // Level 4.5 means 4 LEDs on and the 5th LED's half on
  async setLevel(level)
  {
    level = this.max(0.0, this.min(this.__led_num, level));
    level *= 8; // there are 8 (noticable) levels of brightness on each segment

    // Place number of 'level' of 1-bits on __state
    for (var i = 0; i < this.__led_num; i++) {
      this.__state[i] = (level > 8) ? ~0 : (level > 0) ? ~(~0 << Math.floor(level)) : 0;

      level -= 8;
    };

    await this.setData(this.__state);
  }


  // Set a single led
  // led (1-__led_num)
  // brightness (0-1)
  async setLed(led, brightness)
  {
    led = this.max(1, min(this.__led_num, led));
    brightness = max(0.0, this.min(brightness, 1.0));

    // Zero based index 0-9 for bitwise operations
    led--;

    // 8 (noticable) levels of brightness
    // 00000000 darkest
    // 00000011 brighter
    // ........
    // 11111111 brightest
    this.__state[led] = ~(~0 << Math.floor(brightness * 8));

    await this.setData(this.__state);
  }


  // Toggle a single led
  // led (1-__led_num)
  async toggleLed(led)
  {
    led = this.max(1, this.min(this.__led_num, led));

    // Zero based index 0-9 for bitwise operations
    led--;

    this.__state[led] = this.__state[led] ? 0 : ~0;

    await this.setData(this.__state);
  }

  // each element in the state will hold the brightness level
  // 00000000 darkest
  // 00000011 brighter
  // ........
  // 11111111 brightest
  async setData(state)
  {
    await this.sendData(GLB_CMDMODE);

    for (var i = 0; i < this.__led_num; i++)
    {
      if (this.__greenToRed)
      {
        // Go backward on state
        await this.sendData(state[this.__led_num - i - 1]);
      }
      else
      {
        // Go forward on state
        await this.sendData(state[i]);
      }
    }

    // Two extra empty bits for padding the command to the correct length
    await this.sendData(0x00);
    await this.sendData(0x00);

    await this.latchData();
  }

  async setBits(bits)
  {
    for (var i = 0; i < this.__led_num; i++)
    {
      if ((bits % 2) == 1)
        this.__state[i] = 0xFF;
      else
        this.__state[i] = 0x00;
      bits >>= 1;
    }

    await this.setData(this.__state);
  }


  // Return the current bits
  getBits()
  {
    var __bits = 0x00;
    for (var i = 0; i < this.__led_num; i++)
    {
      if (this.__state[i] != 0x0)
        __bits |= (0x1 << i);
    }
    return __bits;
  }

  setLedNum(num){
    this.__led_num = num;
  }

  wait_async(timeout){
    return new Promise((resolve, reject) =>{
      setTimeout(resolve, timeout);
    });
  }
}

//module.exports = Grove_LED_Bar;