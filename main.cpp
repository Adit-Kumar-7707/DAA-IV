#include <iostream>
#include <vector>
#include <algorithm>
#include <queue>
#include <climits>
#include <list>

using namespace std;
typedef pair<int, int> Pair;

class Graph{
    private: 
        int vertices;
        vector<list<Pair>> adjLists;
    public: 
        Graph(int vertices){
            this->vertices=vertices;
            adjLists.resize(vertices);
        }
        friend vector<int>djikstras(Graph &g, int src);
        void addEdge(int src, int dest, int weight){
            adjLists[src].push_back({dest, weight});
        }
        void removeEdge(int src, int dest){
            adjLists[src].remove_if([dest](const Pair& p){
                return p.first == dest;
            });
        }
        bool searchEdge(int src, int dest){
            for(auto const& edge : adjLists[src]){
                if(edge.first == dest){
                    return true;
                }
            }
            return false;
        }
        void printGraph(){
            for(int i=0; i<vertices; i++){
                cout<<"Mandi "<<i<<" ->";
                if(adjLists[i].empty()){
                    cout<<"none";
                }
                else{
                    for(auto const& edge : adjLists[i]){
                        cout<<edge.first<<" ("<<edge.second<<") ";
                    }
                }
                cout<<endl;
            }
        }
};
vector<int> djikstras(Graph &g, int src){
    priority_queue<Pair, vector<Pair>, greater<Pair>>pq;
    vector<int> distance(g.vertices, INT_MAX);
    distance[src]=0;
    pq.push({0, src});
    while(!pq.empty()){
        int u = pq.top().second;
        int d = pq.top().first;
        pq.pop();
        if(d <= distance[u]){
            for(auto const& i: g.adjLists[u]){
                int v = i.first;
                int weight = i.second;
                if(distance[v]>distance[u]+weight){
                    distance[v] = distance[u]+weight;
                    pq.push({distance[v], v});
                }
            }
        }
    }
    cout<<"shortest distance from Mandi "<<src<<": "<<endl;
    for(int i=0; i<g.vertices; i++){

        cout<<"to Mandi "<<i<<" :";
        if(distance[i]==INT_MAX){
            cout<<"infinty"<<endl;
        }
        else{
            cout<<distance[i]<<endl;
        }
    }
    cout<<endl;
    return distance;
}
struct Mandi{
    int mandi;
    int netProfit;
    int distance;

    bool operator>(const Mandi& other) const{
        return netProfit > other.netProfit;
    }
};

// add a time keeper to link with the html and css based website and also add a google maps embedd


void optimizeProfit(int src, const vector<int>& distance, const vector<int>& mandiPrices, int quantity, int transportCost){
    vector<Mandi> rank;
    for(int i=0; i<distance.size(); i++){
        if(distance[i]!=INT_MAX){
            int revenue = mandiPrices[i]*quantity;
            int cost = distance[i]*transportCost;
            int profit = revenue-cost;
            rank.push_back({i, profit, distance[i]});
        }
    }
    sort(rank.begin(), rank.end(), greater<Mandi>());

    cout<<"----- Ranking of Mandi based on profit -----"<<endl;
    for(const auto& m : rank){
        cout<<endl;
        cout<<"Mandi    : "<<m.mandi<<endl;
        cout<<"Profit   : "<<m.netProfit<<endl;
        cout<<"Distance : "<<m.distance<<endl;
    }
}
int main() {
    int totalLocations = 5; 
    Graph mandiLocation(totalLocations);
    
    mandiLocation.addEdge(0, 1, 10);
    mandiLocation.addEdge(0, 2, 3);
    mandiLocation.addEdge(1, 3, 2);
    mandiLocation.addEdge(2, 1, 1);
    mandiLocation.addEdge(2, 4, 8);

    int farmerLocation = 0;
    int cropQuantity = 100;
    int transportRate = 2; 
    
    vector<int> mandiPrices = {0, 500, 480, 550, 600}; 

    mandiLocation.printGraph();

    vector<int> distance = djikstras(mandiLocation, farmerLocation);
    optimizeProfit(farmerLocation, distance, mandiPrices, cropQuantity, transportRate);
    
    return 0;
}