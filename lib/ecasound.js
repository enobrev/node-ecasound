var fs        = require('path');
var spawn     = require('child_process').spawn;
    
var trim = function(sString) {
    return sString.replace(/^\s+|\s+$/g, '');
};

var ECASound = function() {
    this._       = {};
    this.aTracks = [];

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
    this.aTracks.push(oTrack);
    var iTracks = this.countTracks();
    this._[oTrack.sName] = iTracks - 1;
    oTrack.setMixer(this, this._[oTrack.sName]);
};

ECASound.prototype.getTrack = function(sName) {
    return this.aTracks[this._[sName]];
};

ECASound.prototype.countTracks = function() {
    return this.aTracks.length;
};

ECASound.prototype.setLength = function(fLength) {
    this.fLength = fLength || null;
};

ECASound.prototype.play = function(fComplete) {
    var aCommand = [];

    for (var i in this.aTracks) {
        var oTrack = this.aTracks[i];
        aCommand.push(oTrack.command());
    }

    this.spawn(aCommand, fComplete);
};

ECASound.prototype.saveAs = function(sFileName, fComplete) {
    var aCommand = [];

    for (var i in this.aTracks) {
        var oTrack = this.aTracks[i];
        aCommand.push(oTrack.command());
    }

    if (this.fLength !== null) {
        aCommand.push('-t:' + this.fLength);
    }

    aCommand.push('-a:all');
    aCommand.push('-o:' + sFileName);
    
    this.spawn(aCommand, fComplete);
};

ECASound.prototype.spawn = function(aCommand, fComplete) {
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

ECASound.prototype.consoleOutput = function() {
    var oOutput = {
        tracks: [],
        command: []
    };

    for (var i in this.aTracks) {
        var oTrack = this.aTracks[i];
        oOutput.command.push(oTrack.command());
        oOutput.tracks.push(oTrack.consoleOutput());
    }

    if (this.fLength !== null) {
        oOutput.command.push('-t:' + this.fLength);
    }

    oOutput.command.push('-a:all');
    oOutput.command.push('-o:whatever-output-filename-is.wav');

    return oOutput;
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
                    var oTrack = this.getTrack(sTrack);

                    if (oTrack !== undefined) {
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

ECASound.Track.prototype.consoleOutput = function() {
    return {
        index:      this.iIndex,
        effects:    this.aEffects,
        queue:      this.mQueue,
        start:      this.mStart,
        emd:        this.mEnd,
        duration:   this.mDuration,
        volume:     this.mVolume,
        name:       this.sName,
        file:       this.sFile
    }
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
        case 'start':    return this.mStart;                  break;
        case 'end':      return this.mStart + this.mDuration; break;
        case 'duration': return this.mDuration;               break;
        case 'volume':   return this.mVolume;                 break;
        default:         return null;
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
                    aFade.push(
                        this.pproperty(oEffect.start), 
                        this.pproperty(oEffect.from) * this.oMixer.countTracks(),
                        this.pproperty(oEffect.start) + this.pproperty(oEffect.duration),
                        this.pproperty(oEffect.to) * this.oMixer.countTracks()
                    );
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
};

module.exports = ECASound;