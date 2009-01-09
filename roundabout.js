
/*

roundabout

copyright 2008 Ross Boucher
Released under the terms of the MIT license.

roundabout is a JavaScript HTTP routing framework. 

*/

roundabout = {}

//configuration options
roundabout.caseSensitive = false;

//store all routing events
roundabout.roads = [];

//constants for http methods
roundabout.HTTP_GET     = "GET";
roundabout.HTTP_POST    = "POST";
roundabout.HTTP_PUT     = "PUT";
roundabout.HTTP_DELETE  = "DELETE";

//constants for common http headers and values
//fixme: fill these in

//route: takes a variable number of arguments, each is a "road"
roundabout.route = function()
{
    for (var i=0, count=arguments.length; i<count; i++)
    {
        var road = arguments[i];
        
        road["$regex"] = road.path.replace(/\*/g, "([a-zA-Z0-9+.;%\-]+)").replace(/{[a-zA-Z0-9]*}/g, "([a-zA-Z0-9+.;%\-]+)").replace(/\//g, "\\/");
        road["$wildcards"] = road.path.match(/(\*)|\{([a-zA-Z0-9]+)\}/g);
        
        //remove the leading and trailing { } from the wildcard name. fixme: wish i could do it in the regex...
        var starCount = 0;
        if (road["$wildcards"])
        {
            for (var i in road["$wildcards"])
            {
                if ((typeof road["$wildcards"][i]) !== (typeof "string"))
                    continue;
                    
                if (road["$wildcards"][i].length > 1)
                    road["$wildcards"][i] = road["$wildcards"][i].substring(1, road["$wildcards"][i].length - 1);
                else
                    road["$wildcards"][i] = starCount++;
            }
        }
        
        roundabout.roads.push(road);
    }
}

roundabout.notFound = function(context)
{
    context.status = 404;
    context.body = "Whoops. Couldn't find what you were looking for";
}

roundabout._notFound = function(context)
{
    context.status = 404;
    roundabout.notFound(context);
}

roundabout.clear = function()
{
    roundabout.roads = [];
}

roundabout.context = function(defaultHeaders)
{
    this.status = 200;
    this.body = "";
    this.headers = {};
    this.wildcards = {};
    
    for (i in defaultHeaders)
        this.headers[i] = defaultHeaders[i];
    
    return this;
}

roundabout.context.prototype.redirect = function(location)
{
    this.status = 307;
    this.headers["Location"] = location;
}

roundabout.defaultHeaders = {
    "Content-type":"text/plain"
}

roundabout.dispatch = function(request)
{
    var context = new roundabout.context(roundabout.defaultHeaders);
    
    try 
    {
        var requestMethod = String(request.getMethod()).toUpperCase(),
            requestPath = roundabout.caseSensitive ? String(request.getPathInfo()) : String(request.getPathInfo()).toLowerCase(),
            found = false;
        
        for (var i=0, roads = roundabout.roads, count=roads.length; i<count && !found; i++)
        {
            var road = roads[i],
                roadPath = roundabout.caseSensitive ? road.path : road.path.toLowerCase(),
                methodBlock = road[requestMethod] || road[requestMethod.toLowerCase()] || null;
            
            var regex = new RegExp("^"+road["$regex"]+"$", roundabout.caseSensitive ? "i" : "");
            
            if (methodBlock && regex.test(requestPath) && (!road["filter"] || road.filter(request)))
            {                
                var resultingWildcards = String(request.getPathInfo()).match(regex);

                for (var wildcardIndex=0, totalWildcards=road["$wildcards"].length; wildcardIndex<totalWildcards; wildcardIndex++)
                    context.wildcards[road["$wildcards"][wildcardIndex]] = resultingWildcards[wildcardIndex+1];

                methodBlock(context);
                found = true;
            }
        }
                
        if (!found)
            roundabout._notFound(context);
    }
    catch (e)
    {
        context.status = 500;
    }

    return [context.status, context.headers, context.body];
}

function doGet(request, response)
{
    var theResponse = roundabout.dispatch(request);

    response.setStatus(theResponse[0]);

    var headers = theResponse[1];

    for (var i in headers)
        response.setHeader(i, headers[i]);
    
    response.getWriter().println(theResponse[2]);
}
