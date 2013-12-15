'use strict';
var assert = require('assert');
var tcpPortUsed = require('./index');
var net = require('net');
//var debug = require('debug')('tcp-port-used-test');

var server;

function freePort(cb) {
    if (!server)
        return cb(new Error('Port not in use'));

    server.close();
    server.unref();
    server = undefined;
    cb();
}

function bindPort(port, cb) {
    if (server)
        return cb(new Error('Free the server port, first.'));

    server = net.createServer();
    server.listen(port);

    function errEventCb(err) {
        server.close();
        if (cb) {
            rmListeners();
            cb(err);
        }
        server = undefined;
    }

    function listenEventCb() {
        if (cb) {
            rmListeners();
            cb();
        }
    }

    function rmListeners() {
        server.removeListener('error', errEventCb);
        server.removeListener('listening', listenEventCb);
    }

    server.on('error', errEventCb);
    server.on('listening', listenEventCb);
}

describe('check arguments', function() {
    it('should not accept negative port numbers', function(done) {
        tcpPortUsed.check(-20, '127.0.0.1')
        .then(function() {
            done(new Error('check unexpectedly succeeded'));
        }, function(err) {
            assert.ok(err && err.message === 'invalid port: -20');
            done();
        });
    });
    it('should not accept invalid types for port numbers', function(done) {
        tcpPortUsed.check('hello', '127.0.0.1')
        .then(function() {
            done(new Error('check unexpectedly succeeded'));
        }, function(err) {
            assert.ok(err && err.message === 'invalid port: \'hello\'');
            done();
        });
    });
    it('should require an argument for a port number', function(done) {
        tcpPortUsed.check()
        .then(function() {
            done(new Error('check unexpectedly succeeded'));
        }, function(err) {
            assert.ok(err && err.message === 'invalid port: undefined');
            done();
        });
    });
    it('should not accept port number > 65535', function(done) {
        tcpPortUsed.check(65536)
        .then(function() {
            done(new Error('check unexpectedly succeeded'));
        }, function(err) {
            assert.ok(err && err.message === 'invalid port: 65536');
            done();
        });
    });
    it('should not accept port number < 0', function(done) {
        tcpPortUsed.check(-1)
        .then(function() {
            done(new Error('check unexpectedly succeeded'));
        }, function(err) {
            assert.ok(err && err.message === 'invalid port: -1');
            done();
        });
    });
});

describe('check functionality for unused port', function() {
    before(function(done) {
        bindPort(44202, function(err) {
            done(err);
        });
    });

    it('should return true for a used port with default host value', function(done) {
        tcpPortUsed.check(44202)
        .then(function(inUse) {
            assert.ok(inUse === true);
            done();
        }, function(err) {
            done(err);
        });
    });

    it('should return true for a used port with given host value', function(done) {
        tcpPortUsed.check(44202, '127.0.0.1')
        .then(function(inUse) {
            assert.ok(inUse === true);
            done();
        }, function(err) {
            assert.ok(false);
            done(err);
        });
    });

    it('should return false for an unused port and default host', function(done) {
        tcpPortUsed.check(44201)
        .then(function(inUse) {
            assert.ok(inUse === false);
            done();
        }, function(err) {
            done(err);
        });
    });

    it('should return false for an unused port and given default host', function(done) {
        tcpPortUsed.check(44201, '127.0.0.1')
        .then(function(inUse) {
            assert.ok(inUse === false);
            done();
        }, function(err) {
            done(err);
        });
    });

    after(function(cb) {
        freePort(function(err) {
            cb(err);
        });
    });
});

describe('waitUntilFreeOnHost', function() {
    this.timeout(2000);

    before(function(cb) {
        bindPort(44203, function(err) {
            cb(err);
        });
    });

    it('should reject promise for used port number after timeout', function(done) {
        tcpPortUsed.waitUntilFreeOnHost(44203, '127.0.0.1', 500, 1000)
        .then(function() {
            done(new Error('waitUntilFreeOnHost unexpectedly succeeded'));
        }, function(err) {
            if (err.message === 'timeout')
                done();
            else
                done(err);
        });
    });

    it('should fufill promise for free port number', function(done) {
        tcpPortUsed.waitUntilFreeOnHost(44205, '127.0.0.1', 500, 4000)
        .then(function() {
            done();
        }, function(err) {
            done(err);
        });
    });

    it('should fufill promise for free port number and default retry and timeout', function(done) {
        tcpPortUsed.waitUntilFreeOnHost(44205)
        .then(function() {
            done();
        }, function(err) {
            done(err);
        });
    });

    it('should reject promise for invalid port number', function(done) {
        tcpPortUsed.waitUntilFreeOnHost()
        .then(function() {
            done(new Error('waitUntilFreeOnHost unexpectedly succeeded'));
        }, function(err) {
            if (err.message === 'invalid port: undefined') {
                done();
            } else {
                done(err);
            }
        });
    });

    after(function(cb) {
        freePort(function(err) {
            cb(err);
        });
    });
});

describe('waitUntilUsedOnHost', function() {

    before(function() {
        setTimeout(function() {
            bindPort(44204);
        }, 2000);
    });

    it('should wait until the port is listening', function(done) {
        this.timeout(5000);
        tcpPortUsed.waitUntilUsedOnHost(44204, '127.0.0.1', 500, 4000)
        .then(function() {
            done();
        }, function(err) {
            done(err);
        });
    });

    it('should reject promise when given an invalid port', function(done) {
        this.timeout(3000);
        tcpPortUsed.waitUntilUsedOnHost('hello', '127.0.0.1', 500, 2000)
        .then(function() {
            done(new Error('waitUntil used unexpectedly successful.'));
        }, function(err) {
            if (err.message === 'invalid port: \'hello\'') {
                done();
            } else {
                done(err);
            }
        });
    });

    it('should timeout when no port is listening', function(done) {
        this.timeout(3000);
        tcpPortUsed.waitUntilUsedOnHost(44205, '127.0.0.1', 500, 2000)
        .then(function() {
            done(new Error('waitUntil used unexpectedly successful.'));
        }, function(err) {
            if (err.message === 'timeout') {
                done();
            } else {
                done(err);
            }
        });
    });

    after(function(cb) {
        freePort(function(err) {
            cb(err);
        });
    });
});

describe('waitUntilFree', function() {
    this.timeout(5000);

    before(function(cb) {
        bindPort(44203, function(err) {
            cb(err);
        });
    });

    it('should reject promise for used port number after timeout', function(done) {
        tcpPortUsed.waitUntilFree(44203, 500, 4000)
        .then(function() {
            done(new Error('waitUntilFree unexpectedly succeeded'));
        }, function(err) {
            if (err.message === 'timeout') {
                done();
            } else {
                done(err);
            }
        });
    });

    it('should fufill promise for free port number', function(done) {
        tcpPortUsed.waitUntilFree(44205, 500, 4000)
        .then(function() {
            done();
        }, function(err) {
            done(err);
        });
    });

    it('should fufill promise for free port number and default retry and timeout', function(done) {
        tcpPortUsed.waitUntilFree(44205)
        .then(function() {
            done();
        }, function(err) {
            done(err);
        });
    });

    it('should reject promise for invalid port number', function(done) {
        tcpPortUsed.waitUntilFree()
        .then(function() {
            done(new Error('waitUntilFreeOnHost: unexpectedly succeeded'));
        }, function(err) {
            if (err.message === 'invalid port: undefined') {
                done();
            } else {
                done(err);
            }
        });
    });

    after(function(cb) {
        freePort(function(err) {
            cb(err);
        });
    });
});

describe('waitUntilUsed', function() {

    before(function() {
        setTimeout(function() {
            bindPort(44204);
        }, 2000);
    });

    it('should wait until the port is listening', function(done) {
        this.timeout(5000);
        tcpPortUsed.waitUntilUsed(44204, 500, 4000)
        .then(function() {
            done();
        }, function(err) {
            done(err);
        });
    });

    it('should reject promise when given an invalid port', function(done) {
        this.timeout(3000);
        tcpPortUsed.waitUntilUsed('hello', 500, 2000)
        .then(function() {
            done(new Error('waitUntil used unexpectedly successful.'));
        }, function(err) {
            if (err.message === 'invalid port: \'hello\'') {
                done();
            } else {
                done(err);
            }
        });
    });

    it('should timeout when no port is listening', function(done) {
        this.timeout(3000);
        tcpPortUsed.waitUntilUsed(44205, 500, 2000)
        .then(function() {
            done(new Error('waitUntil used unexpectedly successful.'));
        }, function(err) {
            if (err.message === 'timeout') {
                done();
            } else {
                done(err);
            }
        });
    });

    after(function(cb) {
        freePort(function(err) {
            cb(err);
        });
    });
});

