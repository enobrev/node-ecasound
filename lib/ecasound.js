/*============================================================================
  Copyright(c) 2011 Mark Armendariz <src@enobrev.com>
  MIT Licensed
============================================================================*/

var fs        = require('path');
var spawn     = require('child_process').spawn;
    
var trim = function(sString) {
    return sString.replace(/^\s+|\s+$/g, '');
};

var ECASound = function() {
    this.oTracks = this._ = {};
    
    this.addTracks(arguments);
};

ECASound.prototype.addTracks = function(aTracks) {
    if (aTracks.length) {
        for (var i in aTracks) {
            this.addTrack(aTracks[i]);
        }
    }
};

ECASound.prototype.addTrack = function(oTrack) {
    this.oTracks[oTrack.sName] = oTrack;
    this.oTracks[oTrack.sName].setMixer(this, this.countTracks());
};

ECASound.prototype.getTrack = function(sName) {
    return this.oTracks[sName];
};

ECASound.prototype.countTracks = function() {
    var iCount = 0;
    for (var i in this.oTracks) {
        iCount++;
    }
    
    return iCount;
};

ECASound.prototype.play = function(fComplete) {
    var aCommand = [];
    
    for (var i in this.oTracks) {
        var oTrack = this.oTracks[i];
        aCommand.push(oTrack.command());
    }
    
    this.spawn(aCommand, fComplete);
};

ECASound.prototype.saveAs = function(sFileName, fComplete) {
    var aCommand = [];
    
    for (var i in this.oTracks) {
        var oTrack = this.oTracks[i];
        aCommand.push(oTrack.command());
    }
     
    aCommand.push('-a:all');
    aCommand.push('-o:' + sFileName);
    
    this.spawn(aCommand, fComplete);
};

ECASound.prototype.spawn = function(aCommand, fComplete) {
    console.log('ecasound', aCommand.join(' '));
    var ecasound = spawn('ecasound', aCommand.join(' ').split(' '));
    var aError = [];

    ecasound.stderr.on('data', function (err)    {
        aError.push(err.toString());
    });

    ecasound.stdout.on('data', function (output) {});
    ecasound.on('exit',        function (code)   {
        if (typeof fComplete == 'function') {
            fComplete();
        }
    });
};

ECASound.prototype.property = function(sExpression) {
    var bChanged    = false;
    
    if (sExpression !== undefined
    &&  sExpression.split !== undefined) {
        var aExpression = sExpression.split(' ');
        for (var i in aExpression) {
            var sProperty = trim(aExpression[i]);
            if (sProperty.match(/\./)) {
                var aProperty = sProperty.split('.');
                if (aProperty.length == 2) {
                    var sTrack = trim(aProperty[0]);
                    var sField = trim(aProperty[1]);

                    if (this.oTracks[sTrack] !== undefined) {
                        var oTrack = this.oTracks[sTrack];
                        var sValue = oTrack.property(sField);

                        if (sValue !== null) {
                            bChanged    = true;
                            sExpression = sExpression.replace(sProperty, sValue);
                        }
                    }
                }
            }
        }
    }
    
    if (bChanged) {
        return eval(sExpression);
    } else {
        return sExpression;
    }
};

ECASound.Track = function(sName, sFile) {
    this.oMixer    = null;
    this.iIndex    = 0;
    this.aEffects  = [];
    
    this.mQueue     = 0;
    this.mStart     = 0;
    this.mEnd       = 0;
    this.mDuration  = 0;
    this.mVolume    = 100;
    this.sName      = sName;
    this.sFile      = sFile;
};

ECASound.Track.prototype.setMixer = function(oECASound, iIndex) {
    this.oMixer = oECASound;
    this.iIndex = iIndex;
};

ECASound.Track.prototype.setEnd = function() {
    this.mEnd = this.mStart + this.mDuration;
};

ECASound.Track.prototype.play = function(mStart) {
    this.mStart  = mStart;
    this.setEnd();
    
    return this;
};

ECASound.Track.prototype.until = function(mDuration) {
    this.mDuration  = mDuration;
    this.setEnd();
    
    return this;
};

ECASound.Track.prototype.queue = function(mQueue) {
    this.mQueue  = mQueue;
    
    return this;
};

ECASound.Track.prototype.volume = function(mVolume) {
    this.mVolume  = mVolume;
    
    return this;
};

ECASound.Track.prototype.fade = function(fTo, mDuration, mStart) {
    var iEffects = this.aEffects.length;
    var fFrom    = 1;
    if (iEffects > 0) {
        fFrom = this.aEffects[iEffects - 1].to;
    }
        
    this.aEffects.push({
        type:     'fade',
        from:     fFrom,
        to:       fTo,
        start:    (mStart || this.mStart),
        duration: mDuration
    });
    
    return this;
};

ECASound.Track.prototype.property = function(sField) {
    switch(sField) {
        case 'start':return this.mStart;break;
        case 'end':return this.mStart + this.mDuration;break;
        case 'duration':return this.mDuration;break;
        case 'volume':return this.mVolume;break;
        default:return null;
    }
};

ECASound.Track.prototype.pproperty = function(sProperty) {
    if (sProperty.replace !== undefined) {
        sProperty = sProperty.replace(/\bme\./, this.sName + '.');
    }
    return this.oMixer.property(sProperty);
};

ECASound.Track.prototype.command = function() {
    var init = function() {
        var aCommand = [];

        if (this.mStart) {
            aCommand.push('playat', this.pproperty(this.mStart));
        }

        if (this.mQueue) {
            aCommand.push('select', this.pproperty(this.mQueue));

            if (this.mDuration) {
                aCommand.push(this.pproperty(this.mDuration));
            }
        }

        aCommand.push(this.sFile);

        return ['-i', aCommand.join(',')].join(' ');
    }.bind(this);
    
    var effects = function() {
        var iFadeMinimum = 0;
        var iFadeMaximum = 100;
        var aFade        = [];
        
        if (this.aEffects.length > 0) {
            for (var i in this.aEffects) {
                var oEffect = this.aEffects[i];
                
                if (oEffect.type == 'fade') {
                    aFade.push(this.pproperty(oEffect.start));
                    aFade.push(this.pproperty(oEffect.from));
                    aFade.push(this.pproperty(oEffect.start) + this.pproperty(oEffect.duration));
                    aFade.push(this.pproperty(oEffect.to));
                }
            }
        }
        
        var aCommand = [];
        var iFade    = aFade.length;
        if (iFade) {
            aFade.unshift(1, iFadeMinimum, iFadeMaximum, iFade / 2);
            aCommand.push('-ea:100');
            aCommand.push('-klg:' + aFade.join(','));
        }

        return aCommand.join(' ');
    }.bind(this);
    
    var aCommand = ['-a:' + this.iIndex];
    aCommand.push(init());
    aCommand.push(effects());
    return aCommand.join(' ');
}

module.exports = ECASound;

/*
 ecasound \
 -a:1 -i:select,0,173,/home/enobrev/code/www/fastsociety.com/dev/video/video/music1.wav \
 -a:2 -i:playat,5.7,/home/enobrev/code/www/fastsociety.com/dev/video/video/9279.mp3 \
 -a:3 -i:playat,33.3,/home/enobrev/code/www/fastsociety.com/dev/video/video/9288.mp3 \
 -a:4 -i:playat,85.8,/home/enobrev/code/www/fastsociety.com/dev/video/video/9409.mp3 \
 -a:5 -i:playat,116.81,/home/enobrev/code/www/fastsociety.com/dev/video/video/9421.mp3 \
 -a:6 -i:playat,149.1,/home/enobrev/code/www/fastsociety.com/dev/video/video/9508.mp3 \
 -a:1 -ea:100 -kl2:1,0,100,0,2 \
      -ea:100 -kl2:1,100,20,3.7,4 \
      -ea:100 -kl2:1,100,500,18.7,4 \
      -ea:100 -kl2:1,100,20,31.3,4 \
      -ea:100 -kl2:1,100,500,46.3,4 \
      -ea:100 -kl2:1,100,20,83.8,4 \
      -ea:100 -kl2:1,100,500,96.8,4 \
      -ea:100 -kl2:1,100,20,114.81,4 \
      -ea:100 -kl2:1,100,500,128.8,4 \
      -ea:100 -kl2:1,100,20,147.1,4 \
      -ea:100 -kl2:1,100,500,162.1,4 \
      -ea:100 -kl2:1,100,0,167,4 \
 -a:2 -ea:100 -kl2:1,0,100,5.7,2 \
      -ea:100 -kl2:1,100,0,18.7,2 \
 -a:3 -ea:100 -kl2:1,0,100,33.3,2 \
      -ea:100 -kl2:1,100,0,46.3,2 \
 -a:4 -ea:100 -kl2:1,0,100,85.8,2 \
      -ea:100 -kl2:1,100,0,96.8,2 \
 -a:5 -ea:100 -kl2:1,0,100,116.81,2 \
      -ea:100 -kl2:1,100,0,128.8,2 \
 -a:6 -ea:100 -kl2:1,0,100,149.1,2 \
      -ea:100 -kl2:1,100,0,162.1,2 \
 -a:all -o:montage-12108.mp3
 */