//
// Autogenerated by Thrift Compiler (0.9.2)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//
var thrift = require('thrift');
var Thrift = thrift.Thrift;
var Q = thrift.Q;


var ttypes = require('./crouton_types');
//HELPER FUNCTIONS AND STRUCTURES

crouton_thrift.ReportingService_Report_args = function(args) {
  this.auth = null;
  this.request = null;
  if (args) {
    if (args.auth !== undefined) {
      this.auth = args.auth;
    }
    if (args.request !== undefined) {
      this.request = args.request;
    }
  }
};
crouton_thrift.ReportingService_Report_args.prototype = {};
crouton_thrift.ReportingService_Report_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.auth = new ttypes.Auth();
        this.auth.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.request = new ttypes.ReportRequest();
        this.request.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

crouton_thrift.ReportingService_Report_args.prototype.write = function(output) {
  output.writeStructBegin('ReportingService_Report_args');
  if (this.auth !== null && this.auth !== undefined) {
    output.writeFieldBegin('auth', Thrift.Type.STRUCT, 1);
    this.auth.write(output);
    output.writeFieldEnd();
  }
  if (this.request !== null && this.request !== undefined) {
    output.writeFieldBegin('request', Thrift.Type.STRUCT, 2);
    this.request.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

crouton_thrift.ReportingService_Report_result = function(args) {
  this.success = null;
  if (args) {
    if (args.success !== undefined) {
      this.success = args.success;
    }
  }
};
crouton_thrift.ReportingService_Report_result.prototype = {};
crouton_thrift.ReportingService_Report_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 0:
      if (ftype == Thrift.Type.STRUCT) {
        this.success = new ttypes.ReportResponse();
        this.success.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

crouton_thrift.ReportingService_Report_result.prototype.write = function(output) {
  output.writeStructBegin('ReportingService_Report_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
    this.success.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

crouton_thrift.ReportingServiceClient = exports.Client = function(output, pClass) {
    this.output = output;
    this.pClass = pClass;
    this._seqid = 0;
    this._reqs = {};
};
crouton_thrift.ReportingServiceClient.prototype = {};
crouton_thrift.ReportingServiceClient.prototype.seqid = function() { return this._seqid; }
crouton_thrift.ReportingServiceClient.prototype.new_seqid = function() { return this._seqid += 1; }
crouton_thrift.ReportingServiceClient.prototype.Report = function(auth, request, callback) {
  this._seqid = this.new_seqid();
  if (callback === undefined) {
    var _defer = Q.defer();
    this._reqs[this.seqid()] = function(error, result) {
      if (error) {
        _defer.reject(error);
      } else {
        _defer.resolve(result);
      }
    };
    this.send_Report(auth, request);
    return _defer.promise;
  } else {
    this._reqs[this.seqid()] = callback;
    this.send_Report(auth, request);
  }
};

crouton_thrift.ReportingServiceClient.prototype.send_Report = function(auth, request) {
  var output = new this.pClass(this.output);
  output.writeMessageBegin('Report', Thrift.MessageType.CALL, this.seqid());
  var args = new crouton_thrift.ReportingService_Report_args();
  args.auth = auth;
  args.request = request;
  args.write(output);
  output.writeMessageEnd();
  return this.output.flush();
};

crouton_thrift.ReportingServiceClient.prototype.recv_Report = function(input,mtype,rseqid) {
  var callback = this._reqs[rseqid] || function() {};
  delete this._reqs[rseqid];
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(input);
    input.readMessageEnd();
    return callback(x);
  }
  var result = new crouton_thrift.ReportingService_Report_result();
  result.read(input);
  input.readMessageEnd();

  if (null !== result.success) {
    return callback(null, result.success);
  }
  return callback('Report failed: unknown result');
};
crouton_thrift.ReportingServiceProcessor = exports.Processor = function(handler) {
  this._handler = handler
}
crouton_thrift.ReportingServiceProcessor.prototype.process = function(input, output) {
  var r = input.readMessageBegin();
  if (this['process_' + r.fname]) {
    return this['process_' + r.fname].call(this, r.rseqid, input, output);
  } else {
    input.skip(Thrift.Type.STRUCT);
    input.readMessageEnd();
    var x = new Thrift.TApplicationException(Thrift.TApplicationExceptionType.UNKNOWN_METHOD, 'Unknown function ' + r.fname);
    output.writeMessageBegin(r.fname, Thrift.MessageType.EXCEPTION, r.rseqid);
    x.write(output);
    output.writeMessageEnd();
    output.flush();
  }
}

crouton_thrift.ReportingServiceProcessor.prototype.process_Report = function(seqid, input, output) {
  var args = new crouton_thrift.ReportingService_Report_args();
  args.read(input);
  input.readMessageEnd();
  if (this._handler.Report.length === 2) {
    Q.fcall(this._handler.Report, args.auth, args.request)
      .then(function(result) {
        var result = new crouton_thrift.ReportingService_Report_result({success: result});
        output.writeMessageBegin("Report", Thrift.MessageType.REPLY, seqid);
        result.write(output);
        output.writeMessageEnd();
        output.flush();
      }, function (err) {
        var result = new crouton_thrift.ReportingService_Report_result(err);
        output.writeMessageBegin("Report", Thrift.MessageType.REPLY, seqid);
        result.write(output);
        output.writeMessageEnd();
        output.flush();
      });
  } else {
    this._handler.Report(args.auth, args.request,  function (err, result) {
      var result = new crouton_thrift.ReportingService_Report_result((err != null ? err : {success: result}));
      output.writeMessageBegin("Report", Thrift.MessageType.REPLY, seqid);
      result.write(output);
      output.writeMessageEnd();
      output.flush();
    });
  }
}

