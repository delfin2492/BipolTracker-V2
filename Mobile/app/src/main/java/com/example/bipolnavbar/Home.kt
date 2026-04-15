package com.example.bipolnavbar

import android.animation.ValueAnimator
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.widget.ImageView
import androidx.fragment.app.Fragment
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.MapView
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.model.*
import com.google.android.material.floatingactionbutton.FloatingActionButton
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET

class Home : Fragment(), OnMapReadyCallback {

    private lateinit var googleMap: GoogleMap
    private lateinit var mapView: MapView
    private lateinit var floatingLogo: ImageView
    private lateinit var fabCenter: FloatingActionButton
    
    // Titik Tengah & Batas Area Jabodetabek
    private val desiredLocation = LatLng(-6.200000, 106.816666) // Pusat Jakarta
    private val areaBounds = LatLngBounds(
        LatLng(-6.650, 106.550), // Sudut Barat Daya (Southwest - Bogor/Tangerang)
        LatLng(-6.050, 107.050)  // Sudut Timur Laut (Northeast - Jakut/Bekasi)
    )

    private val checkInterval: Long = 5000
    private val handler = Handler()
    private lateinit var apiService: ApiService
    private val busMarkers = HashMap<String, Marker>()
    private var isFirstLoad = true

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val rootView = inflater.inflate(R.layout.fragment_home, container, false)
        mapView = rootView.findViewById(R.id.id_map)
        floatingLogo = rootView.findViewById(R.id.floatingLogo)
        fabCenter = rootView.findViewById(R.id.fab_center)
        
        mapView.onCreate(savedInstanceState)
        mapView.getMapAsync(this)

        fabCenter.setOnClickListener {
            googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(desiredLocation, 10.0f))
        }

        return rootView
    }

    override fun onMapReady(map: GoogleMap?) {
        this.googleMap = map ?: return

        // --- LOCK MAPS SETTINGS ---
        googleMap.setLatLngBoundsForCameraTarget(areaBounds) // Batasi maksimal pergeseran GPS
        googleMap.setMinZoomPreference(9.0f) // Izinkan Zoom Out hingga mode Jabodetabek
        googleMap.setMaxZoomPreference(18.0f) // Kunci Zoom In
        // --------------------------

        try {
            googleMap.setMapStyle(MapStyleOptions.loadRawResourceStyle(requireContext(), R.raw.map_style))
        } catch (e: Exception) { e.printStackTrace() }

        val bitmap = BitmapFactory.decodeResource(resources, R.drawable.bipol)
        val markerIcon = BitmapDescriptorFactory.fromBitmap(bitmap)

        setupRoutes()
        addStaticMarkers()

        googleMap.moveCamera(CameraUpdateFactory.newLatLngZoom(desiredLocation, 10.0f))

        val retrofit = Retrofit.Builder()
            .baseUrl("https://hexacomm.or.id/")
            .addConverterFactory(GsonConverterFactory.create())
            .client(createOkHttpClient())
            .build()

        apiService = retrofit.create(ApiService::class.java)
        startTracking(markerIcon)
    }

    private fun setupRoutes() {
        // Data Rute Pagi & Sore (Dipisahkan agar kode lebih bersih)
        val rutePagi = listOf(
            LatLng(-6.371652849002165, 106.82442672767823), LatLng(-6.371666869491176, 106.82406284331717),
            LatLng(-6.371629588149347, 106.82400869439084), LatLng(-6.3713856816309535, 106.82397919037493),
            LatLng(-6.371125781310585, 106.82396309736485), LatLng(-6.370600649527726, 106.82394968631164),
            LatLng(-6.370250116860132, 106.82392822882588), LatLng(-6.370231457453673, 106.82419510857854),
            LatLng(-6.366948701129196, 106.82403417601651), LatLng(-6.366927375783644, 106.82307662740313),
            LatLng(-6.366928708593834, 106.82295190468999), LatLng(-6.366877515581393, 106.82265038025012),
            LatLng(-6.366740391778335, 106.82238625718091), LatLng(-6.366135087934355, 106.8217141232146),
            LatLng(-6.365903935986858, 106.8215308140501), LatLng(-6.365745263799935, 106.82145197141364),
            LatLng(-6.365717839207456, 106.8214421159044), LatLng(-6.365443591093928, 106.8214322606977),
            LatLng(-6.365228110451426, 106.82152292950728), LatLng(-6.361813630190757, 106.82258074355968),
            LatLng(-6.36156628675808, 106.82267765903862), LatLng(-6.360561618247093, 106.82300577227879),
            LatLng(-6.349295297042475, 106.82646484915253), LatLng(-6.348881237733786, 106.82662961097681),
            LatLng(-6.348645861184371, 106.82679056241071), LatLng(-6.348504178797341, 106.82699060247094),
            LatLng(-6.3481842494709815, 106.82762980989762), LatLng(-6.348127118997285, 106.82781145521375),
            LatLng(-6.348124834250687, 106.82814715428164), LatLng(-6.348686589888224, 106.83132063747823),
            LatLng(-6.348812276115519, 106.83161265009271), LatLng(-6.348996564738525, 106.83179664735408),
            LatLng(-6.3491492477541085, 106.83189526988951), LatLng(-6.349399949471629, 106.83194268527521),
            LatLng(-6.349586562107233, 106.83191423626853), LatLng(-6.351188705704311, 106.83154951832383),
            LatLng(-6.351352158746319, 106.83154951797322), LatLng(-6.351778800340975, 106.83169725593977),
            LatLng(-6.352011514222904, 106.8318143315671), LatLng(-6.3524132211112905, 106.83192304430808),
            LatLng(-6.353014397092337, 106.83190074442314), LatLng(-6.354139174955968, 106.83166659344568),
            LatLng(-6.354333102237226, 106.8315857556035), LatLng(-6.355903909292467, 106.83034809932248),
            LatLng(-6.356067360251776, 106.83026168792674), LatLng(-6.356229155723879, 106.83020315015507),
            LatLng(-6.35654017224898, 106.83019177056302), LatLng(-6.356738091801801, 106.830222116269),
            LatLng(-6.356883232821711, 106.83027522131749), LatLng(-6.357058533052631, 106.83039281115632),
            LatLng(-6.358062508867046, 106.83116913303435), LatLng(-6.358205763954129, 106.83121275452656),
            LatLng(-6.362196287857281, 106.83183145727551), LatLng(-6.362686369678626, 106.83188835612688),
            LatLng(-6.363206608337798, 106.83196611676709), LatLng(-6.364137759619623, 106.83214819087186),
            LatLng(-6.364463850705876, 106.83218612295519), LatLng(-6.364786171822743, 106.83219370944018),
            LatLng(-6.367655009436075, 106.83213870806277), LatLng(-6.3678076870555405, 106.83210077593748),
            LatLng(-6.368703017072651, 106.83121505931135), LatLng(-6.368848154853232, 106.83109936601988),
            LatLng(-6.369117695630399, 106.83104626118912), LatLng(-6.36989615967564, 106.83100074261294),
            LatLng(-6.370508751524728, 106.83097987993587), LatLng(-6.370763212744939, 106.8309191884381),
            LatLng(-6.371013903735322, 106.83077125307008), LatLng(-6.371238206455704, 106.8305588327837),
            LatLng(-6.371645343487923, 106.82989312322047), LatLng(-6.3716736168969215, 106.82972242824667),
            LatLng(-6.37164157346438, 106.82857118742204), LatLng(-6.371628379021292, 106.82777650791444),
            LatLng(-6.371581257070012, 106.82754701861623), LatLng(-6.371360724174208, 106.82722649165235),
            LatLng(-6.3693231498366885, 106.82532988352169), LatLng(-6.369027220068561, 106.82509849740109),
            LatLng(-6.368752024143348, 106.82502263320343), LatLng(-6.3685428002266695, 106.8249922870877),
            LatLng(-6.367234674795403, 106.82497901093811), LatLng(-6.367144199176982, 106.82495625163756),
            LatLng(-6.367000946073418, 106.82480641967074), LatLng(-6.366929319410343, 106.82462434540332),
            LatLng(-6.366934973541951, 106.82419950519345), LatLng(-6.367734175163849, 106.8242222638335),
            LatLng(-6.370610536458855, 106.82436830225195), LatLng(-6.370678392243527, 106.82441571783855),
            LatLng(-6.371102493717312, 106.82441761492113), LatLng(-6.371366379045477, 106.82441002835097),
            LatLng(-6.371654768165203, 106.82443089088757)
        )
        val ruteSore = listOf(
            LatLng(-6.351814, 106.831697), LatLng(-6.352137, 106.831863), LatLng(-6.352489, 106.831920),
            LatLng(-6.352952, 106.831879), LatLng(-6.354154, 106.831673), LatLng(-6.355982, 106.830275),
            LatLng(-6.356449, 106.830157), LatLng(-6.356934, 106.830284), LatLng(-6.358163, 106.831209),
            LatLng(-6.362697, 106.831871), LatLng(-6.363241, 106.831955), LatLng(-6.364361, 106.832169),
            LatLng(-6.364643, 106.832180), LatLng(-6.367669, 106.832126), LatLng(-6.367791, 106.832097),
            LatLng(-6.367906, 106.832024), LatLng(-6.368770, 106.831142), LatLng(-6.368884, 106.831072),
            LatLng(-6.370622, 106.830954), LatLng(-6.370801, 106.830900), LatLng(-6.371273, 106.830509),
            LatLng(-6.371675, 106.829755), LatLng(-6.371609, 106.827644), LatLng(-6.371366, 106.827234),
            LatLng(-6.369023, 106.825107), LatLng(-6.368711, 106.825008), LatLng(-6.367202, 106.824992),
            LatLng(-6.367021, 106.824868), LatLng(-6.366925, 106.824643), LatLng(-6.366933, 106.824187),
            LatLng(-6.370596, 106.824361), LatLng(-6.370686, 106.824404), LatLng(-6.371635, 106.824423),
            LatLng(-6.371653, 106.824062), LatLng(-6.371604, 106.824007), LatLng(-6.371159, 106.823978),
            LatLng(-6.371159, 106.823978), LatLng(-6.370263, 106.823942), LatLng(-6.370237, 106.824207),
            LatLng(-6.366937, 106.824042), LatLng(-6.366918, 106.822922), LatLng(-6.366770, 106.822439),
            LatLng(-6.365893, 106.821538), LatLng(-6.365460, 106.821445), LatLng(-6.363840, 106.821978),
            LatLng(-6.363858, 106.822061), LatLng(-6.365354, 106.821599), LatLng(-6.365646, 106.821573),
            LatLng(-6.365879, 106.821670), LatLng(-6.366674, 106.822449), LatLng(-6.366843, 106.822984),
            LatLng(-6.366860, 106.824922), LatLng(-6.367109, 106.825128), LatLng(-6.368654, 106.825088),
            LatLng(-6.368965, 106.825182), LatLng(-6.371310, 106.827334), LatLng(-6.371536, 106.827731),
            LatLng(-6.371583, 106.829861), LatLng(-6.371206, 106.830465), LatLng(-6.370821, 106.830775),
            LatLng(-6.370522, 106.830884), LatLng(-6.369008, 106.830933), LatLng(-6.368784, 106.831022),
            LatLng(-6.367819, 106.831985), LatLng(-6.367664, 106.832055), LatLng(-6.364487, 106.832105),
            LatLng(-6.363674, 106.831961), LatLng(-6.363386, 106.831781), LatLng(-6.363010, 106.831666),
            LatLng(-6.362749, 106.831655), LatLng(-6.362410, 106.831768), LatLng(-6.358165, 106.831079),
            LatLng(-6.357987, 106.831009), LatLng(-6.356843, 106.830148), LatLng(-6.356521, 106.830076),
            LatLng(-6.356134, 106.830124), LatLng(-6.355881, 106.830258), LatLng(-6.354294, 106.831477),
            LatLng(-6.354008, 106.831595), LatLng(-6.352601, 106.831837), LatLng(-6.352337, 106.831831),
            LatLng(-6.351833, 106.831649), LatLng(-6.351814, 106.831697)
        )

        googleMap.addPolyline(PolylineOptions().width(8f).color(Color.parseColor("#BF1E2E")).addAll(rutePagi))
        googleMap.addPolyline(PolylineOptions().width(8f).color(Color.parseColor("#159BB3")).addAll(ruteSore))
    }

    private fun addStaticMarkers() {
        val haltePNJ = LatLng(-6.371168, 106.823983)
        val halteUI = LatLng(-6.360951, 106.831581)
        val haltePocin = LatLng(-6.368193, 106.831678)
        val halteMenwa = LatLng(-6.353486, 106.831739)

        googleMap.addMarker(MarkerOptions().position(haltePNJ).title("Halte PNJ"))
        googleMap.addMarker(MarkerOptions().position(halteUI).title("Halte St. UI"))
        googleMap.addMarker(MarkerOptions().position(haltePocin).title("Halte St. Pondok Cina"))
        googleMap.addMarker(MarkerOptions().position(halteMenwa).title("Halte Menwa UI"))
    }

    private fun startTracking(markerIcon: BitmapDescriptor) {
        val runnable = object : Runnable {
            override fun run() {
                apiService.getData().enqueue(object : Callback<DataResponse> {
                    override fun onResponse(call: Call<DataResponse>, response: Response<DataResponse>) {
                        if (response.isSuccessful) {
                            response.body()?.data?.let { busList -> updateBusMarkers(busList, markerIcon) }
                        }
                    }
                    override fun onFailure(call: Call<DataResponse>, t: Throwable) { t.printStackTrace() }
                })
                handler.postDelayed(this, checkInterval)
            }
        }
        handler.post(runnable)
    }

    private fun updateBusMarkers(busList: List<BusData>, markerIcon: BitmapDescriptor) {
        val currentIds = busList.map { it.bus_id }.toSet()
        val iterator = busMarkers.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (!currentIds.contains(entry.key)) {
                entry.value.remove()
                iterator.remove()
            }
        }

        for (busData in busList) {
            val busLocation = LatLng(busData.latitude, busData.longitude)
            if (busMarkers.containsKey(busData.bus_id)) {
                animateMarker(busMarkers[busData.bus_id]!!, busLocation)
            } else {
                val marker = googleMap.addMarker(MarkerOptions()
                    .position(busLocation)
                    .title("Bipol ${busData.bus_id}")
                    .icon(markerIcon))
                busMarkers[busData.bus_id] = marker
            }
        }

        if (isFirstLoad && busList.isNotEmpty()) {
            googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(desiredLocation, 10.0f))
            isFirstLoad = false
        }
    }

    private fun animateMarker(marker: Marker, toPosition: LatLng) {
        val startPosition = marker.position
        val valueAnimator = ValueAnimator.ofFloat(0f, 1f)
        valueAnimator.duration = 1000
        valueAnimator.interpolator = LinearInterpolator()
        valueAnimator.addUpdateListener { animation ->
            val v = animation.animatedFraction
            val lng = v * toPosition.longitude + (1 - v) * startPosition.longitude
            val lat = v * toPosition.latitude + (1 - v) * startPosition.latitude
            marker.position = LatLng(lat, lng)
        }
        valueAnimator.start()
    }

    private fun createOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder().addInterceptor(Interceptor { chain ->
            val request: Request = chain.request().newBuilder()
                .addHeader("Authorization", "cff2f609d3accf61df924590eac88bc2e5107eb3df47af97576f3ab6139e59bc")
                .build()
            chain.proceed(request)
        }).build()
    }

    override fun onResume() { super.onResume(); mapView.onResume() }
    override fun onPause() { super.onPause(); mapView.onPause() }
    override fun onDestroy() { super.onDestroy(); mapView.onDestroy() }
    override fun onLowMemory() { super.onLowMemory(); mapView.onLowMemory() }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); mapView.onSaveInstanceState(outState) }
}

data class BusData(
    val bus_id: String,
    val latitude: Double,
    val longitude: Double
)

data class DataResponse(
    val data: List<BusData>,
    val message: String,
    val statusCode: Int
)

interface ApiService {
    @GET("api/tracking")
    fun getData(): Call<DataResponse>
}
