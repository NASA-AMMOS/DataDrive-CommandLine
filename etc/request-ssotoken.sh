#!/bin/bash

# request-ssotoken.sh uses the user's credential to obtain an SSO token from the CAM Server.
# The SSO token and other cookies are written to a cookie file.
# The cookie file can be used by curl to access CAM protected resources.

# Copied from https://github.jpl.nasa.gov/ASEC/CAM/blob/master/css-resources/cam-client/bin/request-ssotoken.sh

PATH=/usr/kerberos/bin:$PATH

function usage {
  echo "Usage: request-ssotoken.sh [-v] -login_method=STRING [-access_manager_uri=URI] [-cam_cookie_file=FILE_PATH]"
  echo "       login_method can have value LDAP_CLI, SECURID_CLI, KERBEROS, or KEYTAB_FILE"
  echo "       KEYTAB_FILE login_method requires -username=STRING and -keytab_file=FILE_PATH"
}

if [ "$1" == "-v" ]; then
  VERBOSE="-v"
  shift
fi
if [ -z "$1" ] || [ "$1" == "help" ] || [ "$1" == "?" ]; then
  usage
  exit 0
fi

#CAM_COOKIE_FILE="$HOME/.cam_cookie_file"
CAM_COOKIE_FILE="$HOME/.mdms/mdms_sso_token"

CAM_HOME="${CAM_HOME:-/ammos/css}"
if [ -f $CAM_HOME/bin/cam-setenv.sh ]; then
  source $CAM_HOME/bin/cam-setenv.sh
fi
CSS_CFG=$CAM_HOME/lib/css.cfg

PATH=$CAM_HOME/cse/bin:/usr/kerberos/bin:$PWD:$PATH
if ! command -v JSON.sh &> /dev/null; then
  echo "ERROR: JSON.sh is not found in $CAM_HOME/cse/bin or in the PATH"
  exit 1
fi

AMMOS_CA_BUNDLE=${AMMOS_CA_BUNDLE:-/ammos/etc/pki/tls/certs/ammos-ca-bundle.crt}
if [ -f $AMMOS_CA_BUNDLE ]; then
  CA="--cacert $AMMOS_CA_BUNDLE"
else
  echo "INFO: $AMMOS_CA_BUNDLE is not found, use -k without server validation."
  CA="-k"
fi

function process_command_line_arguments {
  for i in "$@"
  do
  case $i in
    -access_manager_uri=*)
      CAM_URI="${i#*=}"
      ;;
    -cam_cookie_file=*)
      CAM_COOKIE_FILE="${i#*=}"
      ;;
    -login_method=*)
      LOGIN_METHOD="${i#*=}"
      ;;
    -username=*)
      USERNAME="${i#*=}"
      ;;
    -keytab_file=*)
      KEYTAB_FILE="${i#*=}"
      ;;
    *)
      echo "ERROR: Invalid argument ${i}"
      usage
      exit 1
      ;;
   esac
   done
}

function verify_login_method {
  if [ -z "$LOGIN_METHOD" ]; then
    #return # allow default
    echo "ERROR: login_method is not specified"
    exit 1
  fi
  if [ "$LOGIN_METHOD" == "KERBEROS" ] ||
     [ "$LOGIN_METHOD" == "KEYTAB_FILE" ] ||
     [ "$LOGIN_METHOD" == "LDAP_CLI" ] ||
     [ "$LOGIN_METHOD" == "SECURID_CLI" ]; then
     return 0
  else
     echo "ERROR: Invalid login_method: $LOGIN_METHOD"
     exit 1
  fi
}

process_command_line_arguments "$@"
verify_login_method

if [[ "$CAM_COOKIE_FILE" == "~/"* ]]; then
  CAM_COOKIE_FILE="${CAM_COOKIE_FILE/#~/$HOME}"
elif [[ "$CAM_COOKIE_FILE" == "~"* ]]; then
  echo "ERROR: Unacceptable cookie file path $CAM_COOKIE_FILE"
  exit 1
fi
if [ -f "$CAM_COOKIE_FILE" ] && [ ! -w "$CAM_COOKIE_FILE" ]; then
  echo "ERROR: cam_cookie_file ($CAM_COOKIE_FILE) not writable"
  exit 1
fi

MDMS_DIR=`dirname $CAM_COOKIE_FILE`
if [ ! -d "$MDMS_DIR" ]; then
    mkdir -p "$MDMS_DIR"
    echo "Directory created: $MDMS_DIR"
fi
if [ ! -f "$CAM_COOKIE_FILE" ] && [ ! -w `dirname $CAM_COOKIE_FILE` ]; then
  echo "ERROR: cam_cookie_file directory ($CAM_COOKIE_FILE) not writable"
  exit 1
fi

if [[ "$KEYTAB_FILE" == "~/"* ]]; then
  KEYTAB_FILE="${KEYTAB_FILE/#~/$HOME}"
elif [[ "$KEYTAB_FILE" == "~"* ]]; then
  echo "ERROR: Unacceptable keytab file path $KEYTAB_FILE"
  exit 1
fi

function get_config_value {
  if [ -f "$CSS_CFG" ]; then
    # xargs is used to trim white spaces
    cat "$CSS_CFG" | grep '^'${1} | cut -d'=' -f2- | xargs
  fi
}

function get_cam_uri {
  if [ -z "$CAM_URI" ]; then
    CAM_URI=$(get_config_value access_manager_uri)
  fi
  if [ -z "$CAM_URI" ]; then
    echo "ERROR: access_manager_uri is not specified and not found in $CSS_CFG"
    exit 1
  fi
  # remove all trailing slashes in CAM_URI
  CAM_URI=$(echo $CAM_URI | sed 's:/*$::')
}

function get_login_method {
  if [ "$LOGIN_METHOD" ]; then
    # passed in from command-line argument
    return 0
  fi
  # get it from css.cfg
  #LOGIN_METHOD=`get_config_value login_method | cut -d'|' -f1`
  klist -5 -s
  if [ $? -eq 0 ]; then
    LOGIN_METHOD="KERBEROS"
  else
    LOGIN_METHOD="LDAP_CLI"
    echo "INFO: login_method is not specified and no Kerberos ticket is found, use LDAP_CLI"
  fi
}

GET="curl --tlsv1.2 $CA -sS"
POST="$GET -c $CAM_COOKIE_FILE -X POST"

# Get the SSO cookie name and set it to CAM_COOKIE_NAME.
# 1) get it from the CAM Server using the JSON API.
# 2) get it from CAM config file css.cfg.
# 3) set it to iPlanetDirectoryPro.
function get_cam_cookie_name
{
  response=`$GET -H "Content-Type: application/json" $CAM_URI/json/serverinfo/*`
  if [ $? != 0 ]; then
    echo "ERROR: failed to connect to $CAM_URI"
    return 1
  fi
  if [[ "$response" == *"cookieName"* ]]; then
    CAM_COOKIE_NAME=`echo $response | JSON.sh -b | grep cookieName | cut -d$'\t' -f 2 | tr -d '"'`
  fi
  if [ "$CAM_COOKIE_NAME" ]; then
    return
  fi
  # get it from css.cfg
  CAM_COOKIE_NAME=`get_config_value sso_token_cookie_name`
  if [ -z "$CAM_COOKIE_NAME" ]; then
    echo "CAM_COOKIE_NAME is not found, use default iPlanetDirectoryPro"
    CAM_COOKIE_NAME=iPlanetDirectoryPro
  fi
}

# Obtain the SSO token from the CAM Server.
# Try Kerberos login first, then asks username/password for LDAP.
# The variable SSOTOKEN will be set or set to "" if failed.
function get_SSO_token
{
  rm -f $CAM_COOKIE_FILE

  get_cam_uri
  get_login_method

  if [ "$LOGIN_METHOD" == "KEYTAB_FILE" ]; then
    if [ -z "$USERNAME" ] || [ -z "$KEYTAB_FILE" ]; then
      echo "ERROR: KEYTAB_FILE login method requires both username and keytab_file arguments"
      exit 1
    fi
    if [ ! -r "$KEYTAB_FILE" ]; then
      echo "ERROR: Cannot find or read keytab file $KEYTAB_FILE"
      exit 1
    fi
    kinit -k -t "$KEYTAB_FILE" "$USERNAME"
    if [ $? -ne 0 ]; then
      echo Failed kinit -k -t $KEYTAB_FILE $USERNAME
      exit 1
    fi
  elif [ "$LOGIN_METHOD" == "KERBEROS" ]; then
    klist -5 -s
    if [ $? != 0 ]; then
      echo "ERROR: Kerberos ticket not found for KERBEROS login_method"
      exit 1
    fi
  fi

  get_cam_cookie_name
  if [ $? != 0 ]; then
    exit 1
  fi

  if [ "$VERBOSE" ]; then
    echo
    echo "$0 -login_method=$LOGIN_METHOD -access_manager_uri=$CAM_URI -cam_cookie_file=$CAM_COOKIE_FILE (sso_token_cookie_name=$CAM_COOKIE_NAME)"
    echo
  fi

  if [ "$LOGIN_METHOD" == KERBEROS ] || [ "$LOGIN_METHOD" == KEYTAB_FILE ]; then
    AUTH_CHAIN="KerberosAuthChain"
    response=`$POST -u : --negotiate \
      -H "Content-Type: application/json" \
      -H "Accept-API-Version: resource=2.0, protocol=1.0" \
      "$CAM_URI/json/authenticate?authIndexType=service&authIndexValue=$AUTH_CHAIN"`
  elif [[ "$LOGIN_METHOD" == "LDAP"* ]] || [[ "$LOGIN_METHOD" == "SECURID"* ]] ; then
    if [[ "$LOGIN_METHOD" == "LDAP"* ]] ; then
      PROMPT="Password"
      AUTH_CHAIN="LDAPAuthChain"
    else
      PROMPT="Passcode"
      AUTH_CHAIN="SecurIDAuthChain"
    fi
    read -r -e -p "Username: " USER
    read -r -s -p "$PROMPT: " PASS
    echo
    response=`$POST -d "{}" -H "Content-Type: application/json" \
      -H "Accept-API-Version: resource=2.0, protocol=1.0" \
      -H "X-OpenAM-Username: $USER" -H "X-OpenAM-Password: $PASS" \
      "$CAM_URI/json/authenticate?authIndexType=service&authIndexValue=$AUTH_CHAIN"`
  fi
  if [ -f "$CAM_COOKIE_FILE" ]; then
    chmod 600 $CAM_COOKIE_FILE
  fi
  if [ "$VERBOSE" ] && ! [[ $response == *"tokenId"* ]]; then
    echo
    echo "CAM Server response = $response"
  fi

  if [[ "$response" == *"tokenId"* ]]; then
    SSOTOKEN=`echo $response | JSON.sh -b | grep tokenId | cut -d$'\t' -f 2 | tr -d '"'`
  fi
  if [ -z "$SSOTOKEN" ] ; then
    echo
    echo "Authentication failed."
    #if [ "$response" ]; then
    #  echo "CAM Server response:" $response
    #fi
    return 1
  fi
  JSON_TEXT="{\"ssoToken\": \"$SSOTOKEN\",\"username\": \"na\"}"
  echo $JSON_TEXT > $CAM_COOKIE_FILE  # storing it to .mdms/mdms_sso_token for aocs-js-client
  # commenting below section.
  # add the SSO cookie to the cookie file if it only has the LB cookie
#  grep $CAM_COOKIE_NAME $CAM_COOKIE_FILE > /dev/null
#  if [ $? != 0 ]; then
#    lbcookie=`grep amlbcookie $CAM_COOKIE_FILE`
#    if [ "$lbcookie" ]; then
#      ssocookie=`echo "$lbcookie" | sed "s/amlbcookie.*/$CAM_COOKIE_NAME	$SSOTOKEN/"`
#      echo -e "$ssocookie" >> $CAM_COOKIE_FILE
#    fi
#  fi
  if [ "$VERBOSE" ]; then
    echo
    echo "Successfully obtained SSO Token.  The token is written to $CAM_COOKIE_FILE"
    echo
  fi
}

get_SSO_token